#!/usr/bin/env bash
# Verifica os exercícios do módulo 10. Chamado por `npm run verificar 10 [estaticos|proxy|extra]`.
# Sobe três contentores numa rede Docker própria: o teu Nginx e dois backends "eco"
# (api e relatorios), e faz pedidos com curl como faria um browser.
set -uo pipefail
cd "$(dirname "$0")"
filtro="${1:-}"
falhas=0
BASE=http://127.0.0.1:3110
REDE=pratica10

ok()    { printf '  \033[32m✔\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✘\033[0m %s\n' "$1"; falhas=$((falhas + 1)); }
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else falha "$d"; fi; }
quer()  { [[ -z "$filtro" || "$1" == *"$filtro"* ]]; }

# Cabeçalhos de resposta de um GET (em minúsculas, para comparar sem surpresas).
cabecalhos() { curl -s -o /dev/null -D - "$@" | tr -d '\r' | tr 'A-Z' 'a-z'; }
codigo()     { curl -s -o /dev/null -w '%{http_code}' "$@"; }

if ! docker info >/dev/null 2>&1; then
  echo "O Docker não está a responder. Arranca o Docker e tenta outra vez."
  exit 1
fi
if ! grep -qE '^\s*server\s*\{' nginx.conf; then
  echo "O nginx.conf ainda não tem nenhum bloco server { }."
  exit 1
fi

limpar() { docker rm -f p10-nginx p10-api p10-relatorios p10-ocupa-ip >/dev/null 2>&1; docker network rm "$REDE" >/dev/null 2>&1; }
trap limpar EXIT
limpar
docker network create "$REDE" >/dev/null

backend() { # backend <nome>: um contentor node com o backend.mjs, conhecido na rede pelo <nome>
  docker run -d --name "p10-$1" --network "$REDE" --network-alias "$1" -e NOME="$1" \
    -v "$PWD/backend.mjs:/backend.mjs:ro" node:22-alpine node /backend.mjs >/dev/null
}
backend api
backend relatorios

# nginx -t: valida a sintaxe antes de arrancar (mostra a linha exata do erro).
if ! docker run --rm --network "$REDE" -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
     nginx:1.27-alpine nginx -t >/tmp/pratica10-t.log 2>&1; then
  echo "  ✘ nginx -t encontrou erros no teu nginx.conf:"; sed 's/^/    /' /tmp/pratica10-t.log
  exit 1
fi
ok "nginx -t: a sintaxe está válida"

docker run -d --name p10-nginx --network "$REDE" -p 127.0.0.1:3110:80 \
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$PWD/site:/usr/share/nginx/html:ro" nginx:1.27-alpine >/dev/null
for _ in $(seq 1 40); do curl -s -o /dev/null "$BASE/" && break; sleep 0.25; done

# ---------------------------------------------------------------------------------------------
if quer estaticos; then
  echo "P1 · Ficheiros estáticos e SPA"
  check "GET / devolve o index.html" bash -c "curl -sf $BASE/ | grep -q 'Servido pelo teu nginx.conf'"
  check "uma rota da SPA (/tarefas/42) também devolve o index.html" \
    bash -c "curl -sf $BASE/tarefas/42 | grep -q 'Servido pelo teu nginx.conf'"
  check "um ficheiro em falta em /assets/ dá 404 (e não o index.html!)" \
    bash -c "[[ \$(curl -s -o /dev/null -w '%{http_code}' $BASE/assets/nao-existe.js) == 404 ]]"
  h=$(cabecalhos "$BASE/assets/app.js")
  check "/assets/app.js com Content-Type de JavaScript" grep -qE 'content-type: (application|text)/javascript' <<<"$h"
  check "/assets/* em cache durante um ano, imutável (max-age=31536000, immutable)" \
    bash -c "grep -q 'cache-control:.*max-age=31536000' <<<'$h' && grep -q 'cache-control:.*immutable' <<<'$h'"
  check "o index.html NÃO fica em cache sem confirmar (Cache-Control: no-cache)" \
    bash -c "cabecalhos() { curl -s -o /dev/null -D - \"\$@\" | tr -d '\r' | tr 'A-Z' 'a-z'; }; cabecalhos $BASE/ | grep -q 'cache-control:.*no-cache'"
fi

# ---------------------------------------------------------------------------------------------
if quer proxy; then
  echo "P2 · Reverse proxy"
  resposta=$(curl -s "$BASE/api/ping")
  check "/api/ping chega ao backend 'api' com o caminho intacto" \
    node -e "const r = JSON.parse(process.argv[1]); process.exit(r.servico === 'api' && r.caminho === '/api/ping' ? 0 : 1)" "$resposta"
  check "/api/relatorios/mensal chega ao backend 'relatorios' (o prefixo mais longo ganha)" \
    node -e "const r = JSON.parse(process.argv[1]); process.exit(r.servico === 'relatorios' && r.caminho === '/api/relatorios/mensal' ? 0 : 1)" \
    "$(curl -s "$BASE/api/relatorios/mensal")"
  check "o backend recebe Host, X-Real-IP, X-Forwarded-For e X-Forwarded-Proto" \
    node -e "const h = JSON.parse(process.argv[1]).cabecalhos;
             process.exit(h.host === 'localhost' || h.host === '127.0.0.1' ? (h['x-real-ip'] && h['x-forwarded-for'] && h['x-forwarded-proto'] === 'http' ? 0 : 1) : 1)" "$resposta"

  # Recriar a API com OUTRO IP: um contentor "ocupa" o IP antigo antes de a API voltar.
  docker rm -f p10-api >/dev/null
  docker run -d --name p10-ocupa-ip --network "$REDE" alpine:3.20 sleep 600 >/dev/null 2>&1 \
    || docker run -d --name p10-ocupa-ip --network "$REDE" node:22-alpine sleep 600 >/dev/null
  backend api
  check "depois de a API ser recriada (com outro IP), o Nginx encontra-a sozinho (resolver)" bash -c "
    for _ in \$(seq 1 30); do
      curl -s $BASE/api/ping | grep -q '\"servico\":\"api\"' && exit 0
      sleep 0.5
    done; exit 1"

  docker stop p10-api >/dev/null
  h=$(cabecalhos "$BASE/api/ping")
  check "com a API em baixo: 502" grep -q '^http/1.1 502' <<<"$h"
  check "...com um corpo JSON {\"error\": ...}, não a página HTML do Nginx" \
    bash -c "grep -q 'content-type: application/json' <<<'$h' && curl -s $BASE/api/ping | grep -q '\"error\"'"
  docker start p10-api >/dev/null
  for _ in $(seq 1 30); do curl -s "$BASE/api/ping" | grep -q servico && break; sleep 0.5; done
fi

# ---------------------------------------------------------------------------------------------
if quer extra; then
  echo "P3 · Segurança e desempenho"
  for caminho in / /api/ping /assets/nao-existe.js; do
    h=$(cabecalhos "$BASE$caminho")
    check "$caminho tem X-Content-Type-Options: nosniff e X-Frame-Options: DENY (também nos erros)" \
      bash -c "grep -q 'x-content-type-options: nosniff' <<<'$h' && grep -q 'x-frame-options: deny' <<<'$h'"
  done
  check "o app.js vai comprimido com gzip quando o browser o aceita" \
    bash -c "curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' $BASE/assets/app.js | tr 'A-Z' 'a-z' | grep -q 'content-encoding: gzip'"
  check "um corpo maior do que 1 KB em /api/ dá 413" \
    bash -c "[[ \$(head -c 2048 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @- $BASE/api/ping) == 413 ]]"
  check "rajada de 40 pedidos a /api/: os primeiros passam, os seguintes levam 429" bash -c "
    sleep 2  # deixa o balde do limite esvaziar dos testes anteriores
    codigos=\$(for _ in \$(seq 1 40); do curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/ping; done)
    [[ \$(head -1 <<<\"\$codigos\") == 200 ]] && grep -q 429 <<<\"\$codigos\""
fi

echo
if (( falhas > 0 )); then echo "$falhas verificação(ões) a falhar."; exit 1; fi
echo "Todas as verificações passaram."
