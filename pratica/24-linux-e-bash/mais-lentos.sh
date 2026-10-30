#!/usr/bin/env bash
# P2 · Os pedidos mais lentos de um log em JSON (um objeto por linha), com o jq.
#
# Uso: ./mais-lentos.sh [N] < pedidos.jsonl      (N por omissão: 3)
#
# Cada linha do stdin é um objeto como:
#   {"ts":"2026-10-29T10:00:00Z","metodo":"GET","caminho":"/api/tasks","status":200,"ms":120}
# Algumas linhas podem não ser JSON (lixo de outro programa): IGNORA-AS em silêncio.
#
# Escreve as N rotas (método + caminho) com a MAIOR média de ms, uma por linha, assim:
#   GET /api/tasks 950
# (média arredondada às unidades, da mais lenta para a mais rápida).
# Se N não for um inteiro positivo: mensagem no stderr e código 2.
