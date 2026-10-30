# 24 · Linux e Bash

**Objetivo:** sentires-te em casa num terminal Linux: ficheiros e permissões, processos e sinais, serviços com o systemd, logs, e escrever scripts de Bash que não falham em silêncio. É o sistema onde correm quase todos os servidores, contentores e pipelines de CI que usaste até aqui.

**Ficheiros para ler:** `scripts/smoke-test.sh` (um script Bash real deste projeto) e os `Dockerfile` de `src/` (cada `RUN` é uma linha de shell).

**Pré-requisitos:** módulo 02 (Docker). Usaste o terminal em todos os módulos; aqui percebes o que está por baixo.

---

## 1. Porque é que um programador de backend precisa disto

Em produção, o teu código corre numa máquina Linux (ou num contentor, que é um Linux). Quando algo corre mal às 3 da manhã, não há interface gráfica: há uma shell, e as perguntas são sempre as mesmas. O processo está vivo? Está a usar a memória toda? O disco encheu? O que diz o log? Quem está a ouvir na porta 3000? Este módulo dá-te as ferramentas para responder a cada uma.

## 2. O sistema de ficheiros

Tudo começa em `/`. As pastas que vais visitar:

| Pasta | O que tem |
|---|---|
| `/etc` | configuração do sistema e dos serviços (`/etc/nginx/`, `/etc/systemd/`) |
| `/var/log` | logs (nos sistemas com systemd, muitos vão para o *journal*, §8) |
| `/var/lib` | dados dos serviços (o Postgres guarda a BD em `/var/lib/postgresql`) |
| `/home/<utilizador>` | as pastas pessoais (`~` é um atalho para a tua) |
| `/tmp` | temporários, apagados no arranque |
| `/opt` | software instalado à parte do gestor de pacotes |
| `/proc` | não são ficheiros a sério: é o kernel a mostrar o estado dos processos |

Em Linux, "tudo é um ficheiro": os discos (`/dev/sda`), o terminal, os processos (`/proc/1234/`). É por isso que tantas ferramentas funcionam com qualquer coisa: leem e escrevem ficheiros.

## 3. Utilizadores e permissões

```bash
$ ls -l backup.sh
-rwxr-x--- 1 bernardo dev 1114 out 29 10:00 backup.sh
 │└┬┘└┬┘└┬┘   └──┬───┘ └┬┘
 │ │  │  │      dono  grupo
 │ │  │  └── outros:  ---  (nada)
 │ │  └───── grupo:   r-x  (ler e executar)
 │ └──────── dono:    rwx  (ler, escrever, executar)
 └────────── tipo: - ficheiro, d pasta, l link
```

Cada permissão vale um número (r=4, w=2, x=1), e cada grupo de três soma-se. É daí que vem o `chmod 750` (dono 7=rwx, grupo 5=r-x, outros 0) e o `chmod 600` de um ficheiro com segredos (só o dono lê e escreve). Numa **pasta**, o `x` quer dizer "poder entrar".

```bash
chmod 600 segredos.env        # só o dono
chmod +x script.sh            # acrescenta o executável a todos
chown notas:notas /var/lib/notas
sudo comando                  # corre como root (pede a tua password e fica registado)
umask 077                     # o que o processo criar a seguir nasce só para o dono
```

O princípio é o mesmo do `USER node` do módulo 02 e do `runAsNonRoot` do módulo 32: cada serviço corre com o seu próprio utilizador, sem privilégios, e só consegue escrever onde precisa. Se for comprometido, o estrago fica contido.

## 4. Processos e sinais

```bash
ps aux | grep node            # todos os processos, filtrados
top                           # (ou htop) CPU e memória em tempo real
pgrep -f server.js            # só os PIDs
kill 1234                     # envia SIGTERM: "termina, por favor"
kill -9 1234                  # envia SIGKILL: morte imediata, sem limpar nada
comando &                     # corre em segundo plano
jobs; fg %1                   # lista e traz para a frente
nohup comando &               # continua a correr depois de fechares o terminal
```

Um **sinal** é uma mensagem do sistema a um processo. Os que importam:

| Sinal | Quando | O processo pode... |
|---|---|---|
| `SIGTERM` (15) | `kill`, `docker stop`, o Kubernetes a parar um pod | apanhá-lo e terminar com cuidado: fechar ligações, acabar os pedidos em curso |
| `SIGINT` (2) | Ctrl+C | o mesmo |
| `SIGKILL` (9) | `kill -9`, ou quando o SIGTERM é ignorado tempo demais | nada: morre logo |
| `SIGHUP` (1) | o terminal fechou; muitos serviços usam-no para "recarrega a configuração" | apanhá-lo |

É por isto que uma API deve tratar o `SIGTERM`: o `docker stop` envia-o e espera 10 segundos antes do `SIGKILL`. Uma API que o apanha deixa de aceitar pedidos novos, acaba os que tem e sai; uma que o ignora é morta a meio de pedidos.

## 5. Entrada, saída e pipes

Todo o processo nasce com três ficheiros abertos: **stdin** (0), **stdout** (1) e **stderr** (2). A regra de ouro dos scripts: **o resultado vai para o stdout, as mensagens de erro e o progresso vão para o stderr**. Assim, quem encadear o teu script com outro recebe só o resultado.

```bash
comando > saida.txt           # stdout para um ficheiro (substitui)
comando >> saida.txt          # acrescenta
comando 2> erros.txt          # stderr para um ficheiro
comando > tudo.txt 2>&1       # os dois para o mesmo sítio
comando 2>/dev/null           # deita fora os erros
echo "erro" >&2               # escreve no stderr (dentro de um script)
a | b                         # o stdout de a é o stdin de b
```

E todo o processo termina com um **código de saída**: 0 é sucesso, qualquer outro número é erro. O `$?` guarda o do último comando. É com ele que o `&&`, o `||`, o `if`, o CI (módulo 20) e o Docker (`HEALTHCHECK`) sabem se algo correu bem. Convenções úteis: 1 para erros gerais, 2 para "foste tu que usaste mal o comando".

## 6. Bash a sério: scripts que não mentem

Um script sem cuidados continua a correr depois de um erro, como se nada fosse. Três opções mudam isso, e põem-se na primeira linha:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

| Opção | Sem ela | Com ela |
|---|---|---|
| `-e` | `cd /pasta-errada; rm -rf *` apaga a pasta atual | o script para no primeiro comando que falha |
| `-u` | `rm -rf "$PASTA/"` com `PASTA` por definir apaga `/` | usar uma variável por definir é um erro |
| `-o pipefail` | `comando-que-falha \| sort` "tem sucesso" (conta só o `sort`) | um pipe falha se qualquer parte falhar |

As outras regras que separam um script frágil de um robusto:

- **Aspas em todas as variáveis:** `"$ficheiro"`, e não `$ficheiro`. Sem aspas, um nome com espaços (`app log.txt`) vira dois argumentos. Os testes do P1 usam um nome com espaços, de propósito.
- **`"$@"`** passa todos os argumentos tal como vieram; `$#` diz quantos são; `$1`, `$2` são cada um.
- **`${VAR:-valor}`** dá um valor por omissão (é o `??` do JavaScript).
- **`[[ ... ]]`** para condições: `[[ -f "$f" ]]` (ficheiro existe), `-d` (pasta), `-r` (dá para ler), `-z "$x"` (vazio), `=~` (regex).
- **`trap 'comando' EXIT`** corre o comando quando o script termina, de qualquer forma: com sucesso, com erro, ou com Ctrl+C. É o `finally` do Bash, e serve para limpar temporários.
- **`mktemp`** cria um temporário com um nome único, em vez de `/tmp/backup.tmp`, que dois scripts ao mesmo tempo partilhariam.
- **Escrever num temporário e depois `mv`:** um `mv` na mesma pasta é atómico. Quem olhar para a pasta ou vê o ficheiro completo, ou não vê nada; nunca um ficheiro a meio.

Uma armadilha que apareceu ao preparar o P4, nesta máquina: o `awk` respeita a configuração regional do sistema. Com `LC_NUMERIC=pt_PT.UTF-8`, `awk 'BEGIN { print 0.1 * 1 }'` escreve `0,1`, e o `sleep` não aceita vírgulas. Um script que vai correr em máquinas que não conheces fixa o `LC_ALL=C` nos comandos em que o formato importa (números, e a ordem do `sort`).

Para apanhar a maior parte destes erros antes de correres o script, há o **ShellCheck** (`shellcheck script.sh`): um linter de Bash que avisa das variáveis sem aspas, dos `cd` sem verificação e de dezenas de outras armadilhas.

## 7. As ferramentas de texto

O Unix foi desenhado à volta de programas pequenos que fazem uma coisa e se encadeiam com pipes:

```bash
grep -n "ERROR" app.log                  # linhas que contêm ERROR, com o número da linha
grep -rn "TODO" src/                     # recursivo, numa pasta
cut -d' ' -f2 app.log                    # o 2.º campo, separado por espaços
awk '{ print $2 }' app.log               # o mesmo, mas o awk sabe muito mais
awk '$5 > 500 { print $3 }' acessos.log  # o 3.º campo das linhas onde o 5.º passa de 500
sort | uniq -c | sort -rn                # contar ocorrências, das mais para as menos frequentes
sed 's/antigo/novo/g' ficheiro           # substituir (sed -i altera o ficheiro)
find . -name "*.log" -mtime +7           # ficheiros .log com mais de 7 dias
find . -name "*.log" -mtime +7 -delete
xargs                                    # transforma linhas em argumentos: ... | xargs rm
head -n 20; tail -n 20; tail -f app.log  # início, fim, e "segue o ficheiro" em tempo real
wc -l                                    # contar linhas
```

O **jq** faz o mesmo para JSON, que é o formato dos logs estruturados (módulo 11), das APIs, e do `docker inspect`:

```bash
curl -s localhost:8080/api/health | jq .                  # formatado e colorido
docker inspect api | jq '.[0].State.Health.Status'
jq -r '.items[] | "\(.id) \(.title)"' tarefas.json      # -r: texto sem aspas
jq -s 'group_by(.status) | map({status: .[0].status, n: length})' pedidos.jsonl
```

## 8. Serviços: systemd e journalctl

Na maior parte das distribuições, o primeiro processo (PID 1) é o **systemd**, que arranca e vigia os serviços. Cada serviço é descrito por uma **unidade**, um ficheiro INI em `/etc/systemd/system/`:

```ini
[Unit]
Description=API de notas
After=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/notas/server.js
User=notas
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload            # depois de criar ou mudar uma unidade
sudo systemctl enable --now notas       # arranca agora e em todos os arranques
systemctl status notas                  # está a correr? últimas linhas do log
sudo systemctl restart notas
journalctl -u notas -f                  # os logs do serviço, em tempo real
journalctl -u notas --since "1 hour ago" -p err   # só erros, da última hora
systemd-analyze verify notas.service    # valida a unidade
```

É o mesmo papel do `restart: unless-stopped` do Docker Compose, ou de um Deployment no Kubernetes, numa máquina só: manter o processo vivo e reiniciá-lo se morrer. As opções de endurecimento (`NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`) dão a um serviço normal parte do isolamento de um contentor. Para tarefas agendadas há os **timers** do systemd, ou o clássico **cron**:

```bash
crontab -e
# minuto hora dia mês dia-da-semana  comando
  0     3    *   *   *               /opt/notas/backup.sh /var/lib/notas /backups >> /var/log/backup.log 2>&1
```

É o mesmo formato do `schedule` do CronJob do módulo 32.

## 9. Diagnóstico rápido: os primeiros 60 segundos

Quando te pedem "o servidor está lento, vê o que se passa":

```bash
uptime                        # carga média do último 1, 5 e 15 minutos
free -h                       # memória (a "available" é a que conta)
df -h                         # disco cheio é a causa de metade dos mistérios
du -sh /var/log/* | sort -h   # o que está a ocupar o disco
top                           # quem está a gastar CPU e memória
ss -tlnp                      # quem está a ouvir em que porta (t=TCP, l=a ouvir, n=números, p=processo)
journalctl -p err -n 50       # os últimos 50 erros do sistema
dmesg -T | tail               # mensagens do kernel (ex.: o OOM killer a matar um processo)
```

## 10. SSH

A forma de entrar num servidor remoto, e o transporte do Git e do Ansible (módulo 34):

```bash
ssh-keygen -t ed25519 -C "eu@portatil"     # um par de chaves: a privada nunca sai da tua máquina
ssh-copy-id utilizador@servidor             # põe a tua chave PÚBLICA no ~/.ssh/authorized_keys de lá
ssh utilizador@servidor
scp ficheiro utilizador@servidor:/tmp/      # copiar
ssh -L 5432:localhost:5432 servidor         # túnel: o Postgres do servidor fica em localhost:5432
```

Num servidor público, desliga o login com password (`PasswordAuthentication no` no `/etc/ssh/sshd_config`) e o login direto como root. Os ataques de força bruta ao SSH começam minutos depois de uma máquina aparecer na Internet.

---

## Prática: escreve tu

Quatro scripts de Bash e uma unidade do systemd. Os testes correm os teus scripts com o `bash`, como farias no terminal: com nomes de ficheiro com espaços, com lixo misturado nos dados, com servidores que falham, e com um `tar` falso que avaria a meio de um backup. Verificam o stdout, o stderr, o código de saída e os ficheiros que ficam no disco.

**Ficheiros:** `pratica/24-linux-e-bash/` (`contar-niveis.sh`, `mais-lentos.sh`, `backup.sh`, `esperar-saude.sh`, `notas.service`)

**Verificar:** `npm run verificar 24` (dentro de `pratica/`). Só um exercício: `npm run verificar 24 contar`, `... 24 lentos`, `... 24 backup`, `... 24 saude` ou `... 24 service`. Precisas do `jq` (em Debian/Ubuntu: `sudo apt install jq`).

Experimenta cada script à mão antes de correres os testes (ex.: `./contar-niveis.sh /var/log/dpkg.log`). Se tiveres o ShellCheck, passa-o pelos teus scripts: os avisos dele são quase sempre bugs à espera de acontecer.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Contar por nível (≈20 min)

**Ficheiro:** `contar-niveis.sh`

O teu primeiro script robusto: validar os argumentos, mandar os erros para o stderr com o código certo, e uma pipeline de texto que conta os níveis de um log.

**Sintaxe que vais praticar:** `set -euo pipefail`, `$#` e `$1`, `[[ -r "$f" ]]`, `echo ... >&2`, `exit 2`, `awk '{ print $2 }'`, `sort | uniq -c`, `sort -k1,1nr -k2,2`.

<details>
<summary>Pista</summary>

O `uniq -c` só junta linhas **seguidas** iguais, por isso precisa de um `sort` antes. A saída dele é `      5 INFO` (contagem primeiro); um último `awk '{ print $2, $1 }'` troca a ordem. Para ordenar por número e desempatar por texto, o `sort` aceita várias chaves: `-k1,1nr` (a 1.ª coluna, numérica, ao contrário) e depois `-k2,2`.
</details>

<details>
<summary>Solução de referência</summary>

```bash
#!/usr/bin/env bash
# -e: para no primeiro erro · -u: variável por definir é um erro · -o pipefail: um pipe falha se QUALQUER parte falhar
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "uso: contar-niveis.sh <ficheiro.log>" >&2
  exit 2
fi

ficheiro="$1"
if [[ ! -r "$ficheiro" ]]; then
  echo "não consigo ler o ficheiro: $ficheiro" >&2
  exit 1
fi

# awk: o 2.º campo de cada linha é o nível. sort | uniq -c conta; o último sort ordena
# pela contagem (-k1,1nr: numérica, decrescente) e, nos empates, pelo nível (-k2,2).
awk '{ print $2 }' "$ficheiro" \
  | sort | uniq -c \
  | sort -k1,1nr -k2,2 \
  | awk '{ print $2, $1 }'
```
</details>

### P2 · Os pedidos mais lentos, com o jq (≈25 min)

**Ficheiro:** `mais-lentos.sh`

Logs estruturados (um JSON por linha), com lixo pelo meio, agrupados por rota e ordenados pela média do tempo de resposta. É a pergunta que fazes a um log real quando a API está lenta.

**Sintaxe que vais praticar:** `${1:-3}`, `[[ "$n" =~ regex ]]`, `jq -R` e `fromjson?`, `jq -s`, `--argjson`, `group_by`, `map`, `add`, `sort_by`, fatias `.[:$n]`, interpolação `"\(...)"`.

<details>
<summary>Pista</summary>

Divide o problema em dois `jq` ligados por um pipe. O primeiro lê linha a linha como texto (`-R`) e converte o que for JSON (`fromjson?`: o `?` descarta os erros em silêncio). O segundo junta tudo numa lista (`-s`) e faz as contas. Para passares o N ao jq como número, usa `--argjson n "$n"` e escreve `$n` dentro do programa.
</details>

<details>
<summary>Solução de referência</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail

n="${1:-3}"
if [[ ! "$n" =~ ^[1-9][0-9]*$ ]]; then
  echo "N tem de ser um inteiro positivo (veio: $n)" >&2
  exit 2
fi

# -R lê cada linha como texto; fromjson? tenta convertê-la e descarta-a em silêncio se não for JSON.
# -s junta tudo numa lista, para podermos agrupar.
jq -R 'fromjson? | select(type == "object")' \
  | jq -rs --argjson n "$n" '
      group_by(.metodo + " " + .caminho)
      | map({ rota: (.[0].metodo + " " + .[0].caminho), media: ((map(.ms) | add) / length) })
      | sort_by(-.media)
      | .[:$n][]
      | "\(.rota) \(.media | round)"'
```
</details>

### P3 · Um backup que não mente (≈35 min)

**Ficheiro:** `backup.sh`

Permissões apertadas, um temporário que só se torna backup quando está completo, limpeza garantida com `trap` mesmo quando algo falha a meio, e rotação dos backups antigos. Os testes substituem o `tar` por um que falha, para confirmar que não fica lixo.

**Sintaxe que vais praticar:** `umask`, `mkdir -p`, `chmod`, `mktemp`, `trap '...' EXIT`, `tar -czf ... -C pasta .`, `mv`, `ls | sort -r | tail -n +N`, `while read -r`, `$(( ))`.

<details>
<summary>Pista</summary>

Cria o temporário com `mktemp "$destino/.backup-XXXXXX.tmp"` (na **mesma** pasta do destino, senão o `mv` deixa de ser atómico) e regista o `trap 'rm -f "$temporario"' EXIT` logo a seguir. Com o `set -e`, se o `tar` falhar o script termina ali, e o `trap` apaga o temporário. Depois do `mv`, o temporário já não existe e o `rm -f` não faz nada.
</details>

<details>
<summary>Solução de referência</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "uso: backup.sh <pasta-a-guardar> <pasta-dos-backups>" >&2
  exit 2
fi
origem="$1"
destino="$2"
keep="${KEEP:-3}"

if [[ ! -d "$origem" ]]; then
  echo "a pasta a guardar não existe: $origem" >&2
  exit 1
fi

# umask 077: tudo o que este script criar nasce só para o dono (pastas 700, ficheiros 600).
umask 077
mkdir -p "$destino"
chmod 700 "$destino"

instante="${AGORA:-$(date +%Y%m%d-%H%M%S)}"
final="$destino/backup-$instante.tar.gz"
temporario="$(mktemp "$destino/.backup-XXXXXX.tmp")"

# Corre na saída do script, com sucesso, erro ou Ctrl+C. Depois do mv, o temporário já não existe.
trap 'rm -f "$temporario"' EXIT

# -C muda para a pasta antes de juntar: os caminhos ficam relativos ("notas.txt", não "/home/.../notas.txt").
tar -czf "$temporario" -C "$origem" .
mv "$temporario" "$final"     # um rename na mesma pasta é atómico: ou há backup completo, ou não há
chmod 600 "$final"

# Os nomes têm a data em AAAAMMDD-HHMMSS, por isso a ordem alfabética é a ordem cronológica.
# tail -n +$((keep + 1)) salta os $keep mais recentes; o resto é apagado.
ls -1 "$destino"/backup-*.tar.gz | sort -r | tail -n +$((keep + 1)) | while read -r antigo; do
  rm -f -- "$antigo"
done

echo "$final"
```
</details>

### P4 · Esperar que um serviço fique saudável (≈25 min)

**Ficheiro:** `esperar-saude.sh`

O passo que vem a seguir a qualquer deploy: chamar o `/health` até responder, com esperas que dobram de cada vez (o *backoff* exponencial, que vais rever no módulo de resiliência), mas com um teto.

**Sintaxe que vais praticar:** `for ((i = 1; ...))`, `curl -s -o /dev/null -w '%{http_code}' --max-time`, `|| true`, padrões em `[[ "$x" == 2?? ]]`, `$((1 << n))`, `sleep` com decimais, `LC_ALL=C`.

<details>
<summary>Pista</summary>

Um `curl` que não consegue ligar sai com erro e, com `set -e`, o script morreria ali: acrescenta `|| true`. O Bash só faz contas com inteiros, por isso calcula o multiplicador (1, 2, 4, 4...) em Bash e a multiplicação pela base decimal com o `awk`. Lê outra vez o fim da secção 6 antes de testares nesta máquina.
</details>

<details>
<summary>Solução de referência</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "uso: esperar-saude.sh <url> [tentativas]" >&2
  exit 2
fi
url="$1"
tentativas="${2:-5}"
base="${ESPERA_BASE:-1}"

for ((i = 1; i <= tentativas; i++)); do
  # -s: sem barra de progresso · -o /dev/null: deita fora o corpo · -w: escreve só o código HTTP
  # || true: um curl que não consegue ligar sai com erro, e com set -e isso pararia o script.
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)"
  if [[ "$codigo" == 2?? ]]; then
    echo "saudável"
    exit 0
  fi
  echo "tentativa $i/$tentativas: ${codigo:-000}" >&2
  if ((i < tentativas)); then
    # base × 2^(i-1), no máximo base × 4. O bash só faz contas com inteiros: o awk faz a conta decimal.
    multiplicador=$((1 << (i - 1)))
    ((multiplicador > 4)) && multiplicador=4
    # LC_ALL=C: num sistema em português, o awk escreveria "0,1", e o sleep só aceita "0.1".
    sleep "$(LC_ALL=C awk -v b="$base" -v m="$multiplicador" 'BEGIN { print b * m }')"
  fi
done

echo "desisti ao fim de $tentativas tentativas: $url" >&2
exit 1
```
</details>

### P5 · Uma unidade do systemd (≈15 min)

**Ficheiro:** `notas.service`

A API de notas como serviço do sistema: quem a corre, com que ambiente, como reinicia, e as proteções que a isolam do resto da máquina.

**Sintaxe que vais praticar:** as secções `[Unit]`, `[Service]` e `[Install]`, `After=`/`Wants=`, `ExecStart=`, `User=`, `Environment=`, `EnvironmentFile=`, `Restart=`, as opções de endurecimento.

<details>
<summary>Solução de referência</summary>

```ini
[Unit]
Description=API de notas
# After= só ordena; Wants= é que pede que o alvo seja mesmo ativado.
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/notas/server.js
WorkingDirectory=/opt/notas
User=notas
Group=notas
Environment=PORT=3000 NODE_ENV=production
# Ficheiro com permissões 600, fora do repositório: JWT_SECRET=..., DATABASE_URL=...
EnvironmentFile=/etc/notas/segredos.env
Restart=on-failure
RestartSec=5
# Endurecimento: sem ganhar privilégios, o sistema de ficheiros só de leitura (exceto os dados),
# e um /tmp privado deste serviço.
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
ReadWritePaths=/var/lib/notas

[Install]
WantedBy=multi-user.target
```

Para a usares a sério numa máquina com systemd: copia-a para `/etc/systemd/system/`, cria o utilizador (`sudo useradd --system notas`), e corre `sudo systemctl daemon-reload && sudo systemctl enable --now notas`.
</details>

## Experiências

1. **Sinais:** corre `node -e "process.on('SIGTERM', () => { console.log('a sair com cuidado'); process.exit(0) }); setInterval(() => {}, 1000)" &` e depois `kill %1`. Repete com `kill -9 %1`. Qual das duas imprime a mensagem?
2. **Pipefail:** corre `false | sort; echo $?` e depois `set -o pipefail; false | sort; echo $?`.
3. **Quem está na porta:** com a stack do workshop a correr, `ss -tlnp | grep 8080` (ou a porta que usares). Depois `docker compose -f config/docker-compose.yml stop web` e repete.
4. **Os logs do teu sistema:** `journalctl -p err --since today` e `journalctl -u docker -n 20`. Há algum erro que não esperavas?
5. **Permissões na prática:** `echo segredo > s.txt; chmod 000 s.txt; cat s.txt`. Volta a dar-te permissão com `chmod 600 s.txt`. Depois experimenta com uma pasta: `mkdir p; chmod 600 p; ls p; cd p`. Porque é que o `cd` falha, mas o `ls` não?

## Perguntas de pensamento crítico

1. Um script de deploy faz `cd $PASTA_APP && rm -rf build/` e não tem `set -u`. O que acontece se a variável `PASTA_APP` não estiver definida num servidor novo?
2. Porque é que um script deve escrever as mensagens de erro no stderr e não no stdout?
3. A tua API demora 20 segundos a terminar os pedidos em curso, mas o `docker stop` só espera 10. O que acontece, e que opções tens?

<details>
<summary>Respostas</summary>

1. O `cd` sem argumento (a variável fica vazia) vai para a pasta pessoal do utilizador, e o `rm -rf build/` apaga a pasta `build` que lá estiver. Pior ainda, um `rm -rf "$PASTA_APP/"` sem `-u` vira `rm -rf "/"`. Com `set -u`, a variável por definir é um erro e o script para antes de apagar seja o que for; com `set -e`, um `cd` que falha também para o script.
2. Porque o stdout é o resultado, que outros programas vão ler e encadear com pipes. Se as mensagens de erro fossem para lá, quem fizesse `./mais-lentos.sh | head -1` recebia uma mensagem de erro como se fosse uma rota. Separados, o resultado pode ir para um ficheiro e os erros continuam a aparecer no terminal (ou no log).
3. Ao fim de 10 segundos, o Docker envia `SIGKILL` e os pedidos que faltavam são cortados a meio: os clientes recebem erros de ligação. As opções: aumentar o prazo (`docker stop -t 30`, ou `stop_grace_period` no compose, ou `terminationGracePeriodSeconds` no Kubernetes); ou, melhor, perceber porque é que um pedido demora tanto e pôr timeouts nas operações lentas.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 24`.

**1.** O que faz o 'set -euo pipefail' no início de um script de Bash?

- a) Torna o script mais rápido
- b) Para no primeiro erro, trata variáveis por definir como erro, e faz um pipe falhar se qualquer parte falhar
- c) Esconde os erros do utilizador
- d) Obriga o script a correr como root

<details><summary>Resposta</summary>

**b) Para no primeiro erro, trata variáveis por definir como erro, e faz um pipe falhar se qualquer parte falhar** — Sem ele, um script continua depois de um comando falhar, e um 'rm -rf "$PASTA/"' com a variável vazia apaga a raiz.

</details>

**2.** Um ficheiro tem permissões 640. O que pode fazer quem não é o dono nem do grupo?

- a) Ler
- b) Ler e escrever
- c) Nada
- d) Executar

<details><summary>Resposta</summary>

**c) Nada** — 6 (rw-) para o dono, 4 (r--) para o grupo, 0 (---) para os outros.

</details>

**3.** Que sinal envia o 'docker stop' (e o Kubernetes) primeiro, para a app poder terminar com cuidado?

- a) SIGKILL
- b) SIGTERM
- c) SIGHUP
- d) SIGSTOP

<details><summary>Resposta</summary>

**b) SIGTERM** — Só se a app não terminar dentro do prazo (10 s por omissão no Docker) é que vem o SIGKILL, que não se pode apanhar.

</details>

**4.** Que comando mostra os logs de um serviço do systemd chamado 'notas', em tempo real?

<details><summary>Resposta</summary>

**journalctl -u notas -f** — O journal guarda os logs de todos os serviços; -u filtra por unidade e -f segue como o tail -f.

</details>

**5.** Porque é que um script deve escrever as mensagens de erro no stderr?

- a) Porque o stderr é mais rápido
- b) Para o stdout ter só o resultado, que outros programas leem e encadeiam com pipes
- c) Porque o stdout não aceita texto com acentos
- d) Porque o stderr fica guardado para sempre

<details><summary>Resposta</summary>

**b) Para o stdout ter só o resultado, que outros programas leem e encadeiam com pipes** — Separados, o resultado pode ir para um ficheiro ou para outro programa e os erros continuam visíveis.

</details>

<!-- quiz:end -->
