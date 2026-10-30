# P1 · Variáveis, locals, for_each e outputs, com o provider "local" (cria ficheiros no teu disco).
# Ver docs/33-terraform.md, secção "Prática".
#
# 1. Bloco terraform: exige o provider hashicorp/local, versão ~> 2.5.
# 2. Variável "ambiente" (string, por omissão "dev"). Só aceita "dev" ou "prod": usa um bloco
#    validation, com uma error_message que contenha a palavra "ambiente".
# 3. Variável "servicos": um map de números (nome do serviço → porta), por omissão
#    { api = 3000, worker = 3001 }.
# 4. Local "prefixo": o ambiente seguido de um hífen (ex.: "dev-").
# 5. Recurso local_file "config", UM POR SERVIÇO (for_each), em gerado/<prefixo><serviço>.env
#    (ex.: gerado/dev-api.env), com este conteúdo exato (duas linhas, cada uma com \n no fim):
#        PORT=3000
#        AMBIENTE=dev
# 6. Output "ficheiros": a lista ORDENADA dos nomes dos ficheiros, sem a pasta
#    (ex.: ["dev-api.env", "dev-worker.env"]).
#
# Antes de correres os testes: terraform fmt (formata o ficheiro como a equipa espera).
