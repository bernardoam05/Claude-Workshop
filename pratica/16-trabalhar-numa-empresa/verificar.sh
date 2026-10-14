#!/usr/bin/env bash
# Verifica os exercícios de Git do módulo 16. Chamado por `npm run verificar 16 [conflito|bisect|rebase]`.
# Cada cenário tem de ter sido criado antes com `npm run git-cenario <nome>`.
set -uo pipefail
cd "$(dirname "$0")"
filtro="${1:-}"
falhas=0

ok()    { printf '  \033[32m✔\033[0m %s\n' "$1"; }
falha() { printf '  \033[31m✘\033[0m %s\n' "$1"; falhas=$((falhas + 1)); }
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else falha "$d"; fi; }
quer()  { [[ -z "$filtro" || "$1" == *"$filtro"* ]]; }
preparado() {
  if [[ ! -d "cenarios/$1/.git" ]]; then
    falha "o cenário '$1' ainda não existe: cria-o com  npm run git-cenario $1"
    return 1
  fi
}

if quer conflito; then
  echo "P1 · Conflito de merge"
  if preparado conflito; then
    g() { git -C cenarios/conflito "$@"; }
    check "estás no branch feature/cache" bash -c "[[ \$(git -C cenarios/conflito branch --show-current) == feature/cache ]]"
    check "o merge terminou (não há um merge a meio)" bash -c "! test -e cenarios/conflito/.git/MERGE_HEAD"
    check "o último commit é um merge do main no feature/cache (dois pais)" \
      bash -c "[[ \$(git -C cenarios/conflito rev-list --parents -n1 HEAD | wc -w) == 3 ]] && git -C cenarios/conflito merge-base --is-ancestor main HEAD"
    check "nada por commitar" bash -c "[[ -z \$(git -C cenarios/conflito status --porcelain) ]]"
    check "não ficaram marcadores de conflito (<<<<<<<, =======, >>>>>>>)" bash -c "! grep -qE '^(<<<<<<<|=======|>>>>>>>)' cenarios/conflito/config.js"
    check "config final: porta 3000, TTL 30 (a tua decisão), cacheMaxEntradas 1000, limitePedidos 200 (do main)" \
      node --input-type=module -e "
        const { config } = await import('$PWD/cenarios/conflito/config.js?' + Date.now());
        const ok = config.porta === 3000 && config.cacheTtlSegundos === 30 && config.cacheMaxEntradas === 1000 && config.limitePedidos === 200;
        process.exit(ok ? 0 : 1);"
  fi
fi

if quer bisect; then
  echo "P2 · git bisect"
  if preparado bisect; then
    check "o bisect foi terminado (git bisect reset) e voltaste ao main" \
      bash -c "! test -e cenarios/bisect/.git/BISECT_LOG && [[ \$(git -C cenarios/bisect branch --show-current) == main ]]"
    check "existe cenarios/bisect-resposta.txt com o hash do commit" test -s cenarios/bisect-resposta.txt
    check "é o hash COMPLETO (40 caracteres) do primeiro commit com o bug" bash -c "
      resposta=\$(tr -d '[:space:]' < cenarios/bisect-resposta.txt)
      [[ \${#resposta} == 40 ]] && [[ \$(echo \"\$resposta\" | sha256sum | cut -d' ' -f1) == \$(cat cenarios/.bisect-esperado) ]]"
  fi
fi

if quer rebase; then
  echo "P3 · Rebase e um histórico limpo"
  if preparado rebase; then
    r=cenarios/rebase
    check "estás no branch feature/estatisticas, sem um rebase a meio" \
      bash -c "[[ \$(git -C $r branch --show-current) == feature/estatisticas ]] && ! test -d $r/.git/rebase-merge && ! test -d $r/.git/rebase-apply"
    check "o branch parte da ponta ATUAL do main (foi rebaseado)" bash -c "[[ \$(git -C $r merge-base main HEAD) == \$(git -C $r rev-parse main) ]]"
    check "tem exatamente UM commit por cima do main (squash)" bash -c "[[ \$(git -C $r rev-list --count main..HEAD) == 1 ]]"
    check "a mensagem segue Conventional Commits: feat(estatisticas): <descrição>" \
      bash -c "git -C $r log -1 --format=%s | grep -qE '^feat\(estatisticas\): .{10,}'"
    check "o estatisticas.js final é exatamente o da versão desarrumada (nada se perdeu)" \
      bash -c "[[ \$(git -C $r rev-parse HEAD:estatisticas.js) == \$(cat cenarios/.rebase-esperado) ]]"
    check "o README do main está lá (o trabalho da Ana não se perdeu)" bash -c "git -C $r show HEAD:README.md | grep -q 'npm start'"
    check "nada por commitar" bash -c "[[ -z \$(git -C $r status --porcelain) ]]"
  fi
fi

echo
if (( falhas > 0 )); then echo "$falhas verificação(ões) a falhar."; exit 1; fi
echo "Todas as verificações passaram."
