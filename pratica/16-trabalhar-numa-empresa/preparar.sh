#!/usr/bin/env bash
# Cria um repositório Git de treino em pratica/16-trabalhar-numa-empresa/cenarios/<nome>.
# Uso (dentro de pratica/):  npm run git-cenario conflito   |   bisect   |   rebase
# Correr outra vez APAGA o cenário e começa do zero (útil para repetir o exercício).
set -euo pipefail
cd "$(dirname "$0")"
cenario="${1:-}"

# Os commits "dos colegas" são feitos com identidades próprias e sem assinatura GPG,
# para não dependerem da tua configuração do Git.
colega() { local nome="$1"; shift; git -c user.name="$nome" -c user.email="$(tr 'A-Z' 'a-z' <<<"$nome")@empresa.pt" -c commit.gpgsign=false "$@"; }

novo_repo() {
  rm -rf "cenarios/$1"
  mkdir -p "cenarios/$1"
  cd "cenarios/$1"
  git init -q -b main
}

case "$cenario" in
  conflito)
    novo_repo conflito
    cat > config.js <<'JS'
export const config = {
  porta: 3000,
  cacheTtlSegundos: 60,
  limitePedidos: 100,
};
JS
    git add config.js && colega Bruno commit -qm "Configuração inicial"

    git switch -qc feature/cache
    cat > config.js <<'JS'
export const config = {
  porta: 3000,
  cacheTtlSegundos: 30,
  cacheMaxEntradas: 1000,
  limitePedidos: 100,
};
JS
    git add config.js && colega Ana commit -qm "Cache mais curta e com limite de entradas"

    git switch -q main
    cat > config.js <<'JS'
export const config = {
  porta: 3000,
  cacheTtlSegundos: 120, // o Bruno achou que 60 s era pouco
  limitePedidos: 200,
};
JS
    git add config.js && colega Bruno commit -qm "Mais tolerância: TTL de 120 s e 200 pedidos"
    git switch -q feature/cache
    echo "Cenário 'conflito' pronto em pratica/16-trabalhar-numa-empresa/cenarios/conflito (estás no branch feature/cache)."
    ;;

  bisect)
    novo_repo bisect
    cat > media.js <<'JS'
// Média de uma lista de números.
export function media(numeros) {
  let soma = 0;
  for (let i = 0; i < numeros.length; i++) soma += numeros[i];
  return numeros.length === 0 ? 0 : soma / numeros.length;
}
JS
    cat > teste.sh <<'SH'
#!/usr/bin/env bash
# Termina com 0 se a média estiver certa, e com 1 se não estiver. É isto que o git bisect run usa.
node --input-type=module -e "
  import { media } from './media.js';
  const ok = media([2, 4, 6]) === 4 && media([]) === 0 && media([5]) === 5;
  process.exit(ok ? 0 : 1);
"
SH
    chmod +x teste.sh
    echo "Histórico de alterações" > NOTAS.md
    git add . && colega Bruno commit -qm "Primeira versão da média" && git tag v1.0
    mensagens=("Documentar a função" "Atualizar notas" "Rever nomes" "Notas da reunião" "Pequena limpeza"
      "Acrescentar exemplo" "Corrigir gralha nas notas" "Notas da sprint" "Reformatar" "Mais notas")
    autores=(Ana Bruno Carla Duarte)
    for i in $(seq 1 40); do
      if [[ $i -eq 27 ]]; then
        # O bug: "i <= numeros.length" lê uma posição a mais (undefined), e a soma passa a NaN.
        sed -i 's/i < numeros.length/i <= numeros.length/' media.js
        colega Carla commit -qam "Refatorar o ciclo da soma"
        git rev-parse HEAD | sha256sum | cut -d' ' -f1 > ../.bisect-esperado
      else
        echo "- nota $i" >> NOTAS.md
        colega "${autores[$((i % 4))]}" commit -qam "${mensagens[$((i % 10))]} (#$i)"
      fi
    done
    echo "Cenário 'bisect' pronto em pratica/16-trabalhar-numa-empresa/cenarios/bisect (41 commits; v1.0 funcionava)."
    ;;

  rebase)
    novo_repo rebase
    echo "# Gestor de tarefas" > README.md
    echo "export const versao = 1;" > versao.js
    git add . && colega Bruno commit -qm "Projeto inicial"

    git switch -qc feature/estatisticas
    printf 'export function total(tarefas) {\n  return tarefas.length;\n}\n' > estatisticas.js
    git add . && colega Tu commit -qm "wip"
    printf 'export function total(tarefas) {\n  return tarefas.length;\n}\n\nexport function feitas(tarefas) {\n  return tarefas.filter((t) => t.done).lenght;\n}\n' > estatisticas.js
    colega Tu commit -qam "mais coisas"
    sed -i 's/lenght/length/' estatisticas.js
    colega Tu commit -qam "corrigir typo"
    printf '\nexport function percentagem(tarefas) {\n  return tarefas.length === 0 ? 0 : Math.round((feitas(tarefas) / total(tarefas)) * 100);\n}\n' >> estatisticas.js
    colega Tu commit -qam "wip 2"
    git rev-parse HEAD:estatisticas.js > ../.rebase-esperado

    git switch -q main
    printf '# Gestor de tarefas\n\nCorre com `npm start`.\n' > README.md
    colega Ana commit -qam "README: como arrancar"
    git switch -q feature/estatisticas
    echo "Cenário 'rebase' pronto em pratica/16-trabalhar-numa-empresa/cenarios/rebase (estás no branch feature/estatisticas)."
    ;;

  *)
    echo "Uso: npm run git-cenario <conflito|bisect|rebase>"
    exit 1
    ;;
esac
