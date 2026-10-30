#!/usr/bin/env bash
# P3 · Um backup com rotação, que não deixa lixo nem quando falha a meio.
#
# Uso: ./backup.sh <pasta-a-guardar> <pasta-dos-backups>
#
# - Cria <pasta-dos-backups> se não existir, com permissões 700 (só o dono entra).
# - Cria lá o ficheiro backup-<AAAAMMDD-HHMMSS>.tar.gz com o conteúdo de <pasta-a-guardar>
#   (dentro do arquivo, os caminhos são relativos: "notas.txt", "sub/x.txt", sem a pasta-mãe).
#   O instante vem da variável de ambiente AGORA, se existir (os testes usam-na); senão, de "date".
# - O ficheiro final tem permissões 600 (um backup pode ter dados pessoais).
# - Escreve primeiro para um ficheiro temporário NA MESMA PASTA e só no fim o renomeia: assim,
#   um backup a meio nunca parece um backup completo. Se o script falhar ou for interrompido,
#   o temporário é apagado (trap).
# - Mantém só os KEEP backups mais recentes (variável de ambiente KEEP, por omissão 3), apagando
#   os mais antigos.
# - No fim, escreve no stdout o caminho do backup criado.
# - Argumentos em falta: uso no stderr, código 2. Pasta a guardar inexistente: código 1.
