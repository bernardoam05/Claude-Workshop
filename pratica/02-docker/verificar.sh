#!/usr/bin/env bash
# Verifica os exercícios do módulo 02. Chamado por `npm run verificar 02 [dockerfile|compose|multistage]`.
# Cada verificação é um comando Docker que podias correr à mão: lê-as, são parte do exercício.
set -uo pipefail
cd "$(dirname "$0")"
filtro="${1:-}"
falhas=0

ok()    { printf '  \033[32m✔\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✘\033[0m %s\n' "$1"; falhas=$((falhas + 1)); }
# check "descrição" comando...  → ✔ se o comando terminar com sucesso, ✘ caso contrário
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else falha "$d"; fi; }
quer()  { [[ -z "$filtro" || "$1" == *"$filtro"* ]]; }

if ! docker info >/dev/null 2>&1; then
  echo "O Docker não está a responder. Arranca o Docker (Docker Desktop ou o serviço) e tenta outra vez."
  exit 1
fi

# Espera até um URL responder com o código HTTP esperado (até ~20 s).
espera_http() {
  local url="$1" esperado="$2"
  for _ in $(seq 1 40); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" == "$esperado" ]] && return 0
    sleep 0.5
  done
  return 1
}

# ---------------------------------------------------------------------------------------------
if quer dockerfile; then
  echo "P1 · Dockerfile da app"
  img=pratica02-app
  # Um node_modules "do host" falso: se o .dockerignore funcionar, nunca chega à imagem.
  mkdir -p app/node_modules && touch app/node_modules/LIXO_DO_HOST
  trap 'rm -rf app/node_modules; docker rm -f pratica02-p1 >/dev/null 2>&1' EXIT

  if ! grep -qiE '^\s*FROM\s' app/Dockerfile; then
    falha "app/Dockerfile ainda não tem nenhum FROM"
  elif ! docker build -q -t "$img" app >/tmp/pratica02-build.log 2>&1; then
    falha "docker build falhou (vê a mensagem abaixo)"; tail -15 /tmp/pratica02-build.log
  else
    ok "a imagem constrói"
    check "a imagem base tem Node 22" docker run --rm --entrypoint sh "$img" -c 'node -v | grep -q "^v22\."'
    check "a imagem base é Alpine (pequena)" docker run --rm --entrypoint test "$img" -f /etc/alpine-release
    check "o processo não corre como root (USER node)" \
      bash -c "[[ \$(docker run --rm --entrypoint whoami $img) == node ]]"
    check ".dockerignore exclui node_modules (o do host não entrou na imagem)" \
      bash -c "grep -q node_modules app/.dockerignore && docker run --rm --entrypoint sh $img -c 'test ! -e node_modules/LIXO_DO_HOST'"
    check "package*.json copiado e npm ci corrido ANTES de copiar o código (cache de camadas)" \
      bash -c "pkg=\$(grep -nE '^\s*COPY .*package' app/Dockerfile | head -1 | cut -d: -f1);
               ci=\$(grep -nE '^\s*RUN .*npm (ci|install)' app/Dockerfile | head -1 | cut -d: -f1);
               code=\$(grep -nE '^\s*COPY .*(server\.js|\. )' app/Dockerfile | grep -v package | head -1 | cut -d: -f1);
               [[ -n \$pkg && -n \$ci && -n \$code && \$pkg -lt \$ci && \$ci -lt \$code ]]"
    check "EXPOSE 3000" bash -c "docker inspect -f '{{json .Config.ExposedPorts}}' $img | grep -q '3000/tcp'"
    check "CMD na forma exec ([\"node\", ...]), não em forma shell" \
      bash -c "docker inspect -f '{{json .Config.Cmd}}' $img | grep -q '^\[\"node\"'"
    check "tem HEALTHCHECK" bash -c "[[ \$(docker inspect -f '{{json .Config.Healthcheck}}' $img) != null ]]"

    docker run -d --name pratica02-p1 -p 127.0.0.1::3000 "$img" >/dev/null
    porta=$(docker port pratica02-p1 3000 | head -1 | sed 's/.*://')
    check "o contentor responde a GET /health" espera_http "http://127.0.0.1:$porta/health" 200
    check "o HEALTHCHECK põe o contentor em 'healthy' (usa --interval curto, ex.: 5s)" bash -c '
      for _ in $(seq 1 30); do
        [[ $(docker inspect -f "{{.State.Health.Status}}" pratica02-p1 2>/dev/null) == healthy ]] && exit 0
        sleep 1
      done; exit 1'
    docker rm -f pratica02-p1 >/dev/null 2>&1
  fi
  rm -rf app/node_modules
fi

# ---------------------------------------------------------------------------------------------
if quer compose; then
  echo "P2 · compose.yaml"
  dc() { docker compose -f compose.yaml -p pratica02 "$@"; }
  if ! cfg=$(dc config --format json 2>/tmp/pratica02-compose.log); then
    falha "compose.yaml inválido ou vazio (docker compose config falhou)"; tail -5 /tmp/pratica02-compose.log
  else
    # As regras estruturais leem o compose já interpretado pelo próprio Docker (com valores por omissão).
    regra() {
      local d="$1" expr="$2"
      if node -e "const c = JSON.parse(require('fs').readFileSync(0, 'utf8')); const s = c.services ?? {};
                  process.exit((${expr}) ? 0 : 1)" <<<"$cfg" 2>/dev/null; then ok "$d"; else falha "$d"; fi
    }
    regra "serviços 'app' e 'redis'" "s.app && s.redis"
    regra "'app' é construída a partir de ./app" "s.app.build && /\/app$/.test(s.app.build.context)"
    regra "'redis' usa uma imagem oficial redis:*-alpine" "/^redis:[^ ]*alpine/.test(s.redis.image ?? '')"
    regra "'app' publicada SÓ em 127.0.0.1:3100" \
      "(s.app.ports ?? []).length === 1 && s.app.ports[0].published == 3100 && s.app.ports[0].target == 3000 && s.app.ports[0].host_ip === '127.0.0.1'"
    regra "'redis' NÃO está publicado no host (só a app lhe acede, pela rede interna)" "!s.redis.ports || s.redis.ports.length === 0"
    regra "'app' recebe REDIS_URL=redis://redis:6379" "s.app.environment?.REDIS_URL === 'redis://redis:6379'"
    regra "'redis' tem healthcheck" "s.redis.healthcheck && !s.redis.healthcheck.disable"
    regra "'app' só arranca quando o redis estiver saudável (depends_on + condition)" \
      "s.app.depends_on?.redis?.condition === 'service_healthy'"
    regra "os dados do redis ficam num volume com nome, montado em /data" \
      "(s.redis.volumes ?? []).some(v => v.type === 'volume' && v.target === '/data') && Object.keys(c.volumes ?? {}).length > 0"

    trap 'docker compose -f compose.yaml -p pratica02 down -v >/dev/null 2>&1' EXIT
    if dc up -d --build --wait >/tmp/pratica02-up.log 2>&1; then
      ok "docker compose up --wait arranca tudo"
      check "GET 127.0.0.1:3100/health responde 200 e fala com o redis" \
        bash -c "espera() { for _ in \$(seq 1 20); do curl -sf http://127.0.0.1:3100/health | grep -q PONG && return 0; sleep 0.5; done; return 1; }; espera"
      dc stop redis >/dev/null 2>&1
      check "com o redis parado, /health passa a 503 (a dependência é real)" espera_http "http://127.0.0.1:3100/health" 503
    else
      falha "docker compose up falhou"; tail -15 /tmp/pratica02-up.log
    fi
    dc down -v >/dev/null 2>&1
  fi
fi

# ---------------------------------------------------------------------------------------------
if quer multistage; then
  echo "P3 · Multi-stage build do site"
  img=pratica02-site
  if [[ $(grep -ciE '^\s*FROM\s' site/Dockerfile) -lt 2 ]]; then
    falha "site/Dockerfile precisa de pelo menos dois FROM (dois estágios)"
  elif ! docker build -q -t "$img" site >/tmp/pratica02-site.log 2>&1; then
    falha "docker build falhou"; tail -15 /tmp/pratica02-site.log
  else
    ok "a imagem constrói"
    check "a imagem final NÃO tem Node" bash -c "! docker run --rm --entrypoint sh $img -c 'command -v node'"
    check "a imagem final tem menos de 80 MB" bash -c "(( \$(docker image inspect -f '{{.Size}}' $img) < 80000000 ))"
    trap 'docker rm -f pratica02-p3 >/dev/null 2>&1' EXIT
    docker run -d --name pratica02-p3 -p 127.0.0.1::80 "$img" >/dev/null
    porta=$(docker port pratica02-p3 80 | head -1 | sed 's/.*://')
    check "serve o index.html gerado pelo build" \
      bash -c "for _ in \$(seq 1 20); do curl -s http://127.0.0.1:$porta/ | grep -q multi-stage && exit 0; sleep 0.5; done; exit 1"
    docker rm -f pratica02-p3 >/dev/null 2>&1
  fi
fi

echo
if (( falhas > 0 )); then echo "$falhas verificação(ões) a falhar."; exit 1; fi
echo "Todas as verificações passaram."
