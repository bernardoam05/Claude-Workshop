#!/usr/bin/env bash
# P1 · Contar as linhas de um log por nível. Ver docs/24-linux-e-bash.md, secção "Prática".
#
# Uso: ./contar-niveis.sh <ficheiro.log>
#
# Cada linha do log tem o formato:  2026-10-29T10:00:00Z ERROR mensagem...
# (data, um espaço, o NÍVEL, um espaço, a mensagem). Os níveis são palavras em maiúsculas.
#
# Escreve no stdout uma linha por nível, "NÍVEL CONTAGEM", da contagem MAIOR para a menor
# (em caso de empate, por ordem alfabética do nível). Ex.:
#   INFO 5
#   ERROR 2
#   WARN 2
#
# Erros (mensagem no STDERR, nada no stdout):
#   - sem argumentos, ou com mais de um → "uso: contar-niveis.sh <ficheiro.log>" e código de saída 2
#   - o ficheiro não existe ou não se pode ler → uma mensagem com o nome do ficheiro e código 1
#
# A primeira linha "a sério" de qualquer script: set -euo pipefail (porquê? secção 6 do módulo).
