#!/usr/bin/env bash
# P4 · Esperar que um serviço fique saudável, com tentativas e backoff (o que um script de deploy faz).
#
# Uso: ./esperar-saude.sh <url> [tentativas]       (tentativas por omissão: 5)
#
# - Faz GET ao URL com o curl (com um timeout de 2 segundos por pedido).
# - Se responder 2xx: escreve "saudável" no stdout e sai com 0.
# - Senão, espera e tenta outra vez: 1 s, depois 2 s, depois 4 s... (o dobro de cada vez), mas
#   nunca mais de 4 s entre tentativas. A espera base pode ser mudada com a variável ESPERA_BASE
#   (em segundos, aceita decimais: os testes usam 0.1).
# - Em cada falha, escreve no STDERR "tentativa X/N: <código HTTP ou 000 se não respondeu>".
# - Esgotadas as tentativas: "desisti" no stderr e código de saída 1.
