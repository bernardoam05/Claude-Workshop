# 19 · CI/CD com GitHub Actions

**Objetivo:** perceber o que é integração contínua, ler o `.github/workflows/ci.yml` deste projeto linha a linha, e saber escrever um workflow novo sem copiar às cegas.

**Ficheiros para ler:** `.github/workflows/ci.yml` (lê-o ao lado deste módulo, secção a secção).

---

## 1. O que é CI/CD, em concreto

- **CI (Continuous Integration):** a cada alteração, uma máquina (não o teu computador) instala as dependências, corre o lint, os testes e o build. Se alguma coisa falhar, sabes **antes** de a alteração chegar a mais ninguém.
- **CD (Continuous Delivery/Deployment):** o passo seguinte, que este projeto **não tem**: depois do CI passar, publicar automaticamente uma imagem ou fazer deploy. A secção 10 mostra como o acrescentarias.

A ideia central: **ninguém confia no "funciona na minha máquina"**. O CI corre numa máquina limpa, sem nada que já tivesses instalado à mão, e por isso apanha dependências esquecidas, variáveis de ambiente que só tu tens, e ficheiros que te esqueceste de fazer commit.

## 2. Vocabulário do GitHub Actions

| Termo | O que é | Onde está no `ci.yml` |
|---|---|---|
| **Workflow** | o ficheiro inteiro: um conjunto de jobs disparados por um evento | `ci.yml` |
| **Evento (`on`)** | o que dispara o workflow | `push`, `pull_request` |
| **Job** | um conjunto de passos que corre numa máquina própria, isolada dos outros jobs | `api`, `worker`, `activity`, `web`, `integration`, `smoke` |
| **Runner** | a máquina (efémera) onde o job corre | `ubuntu-latest` |
| **Step** | uma ação dentro de um job: ou corre uma *action* (`uses`) ou um comando de shell (`run`) | `- run: npm test` |
| **Action** | código reutilizável, feito por outros (ou por ti), publicado no Marketplace | `actions/checkout@v4` |
| **Secrets** | valores confidenciais, cifrados, geridos na página do repositório | não usados aqui (os valores do CI são deliberadamente falsos) |

## 3. `on`: o que dispara o workflow

```yaml
on:
  push:
  pull_request:
```

Corre em **todos** os pushes e em todos os pull requests. Alternativas comuns que vais ver noutros projetos:

```yaml
on:
  push:
    branches: [main]        # só quando o destino é main
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'     # todas as segundas às 6h (ex.: correr testes de regressão)
  workflow_dispatch: {}      # botão "Run workflow" manual, na interface do GitHub
```

**Porque correr em `pull_request` *e* em `push`?** Em `pull_request`, o CI valida a alteração antes de ela entrar no `main`. Em `push` (ex.: depois do merge), confirma que o `main` continua saudável. São verificações com propósitos diferentes.

## 4. `permissions`: o princípio do menor privilégio

```yaml
permissions:
  contents: read
```

Por omissão, o `GITHUB_TOKEN` automático de cada execução tem permissões generosas (pode escrever no repositório, em *issues*, etc.). Este workflow só **lê** código — não cria releases, não comenta em PRs, não publica imagens — por isso pedimos só `contents: read`. Se um step ou uma dependência de uma *action* for comprometida, o dano máximo que consegue fazer é ler o código, nunca alterar o repositório.

## 5. Um job, por dentro: `api`

```yaml
api:
  name: API · testes unitários
  runs-on: ubuntu-latest
  timeout-minutes: 10
  defaults:
    run:
      working-directory: src/api
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
        cache-dependency-path: src/api/package-lock.json
    - run: npm ci
    - run: npm run lint
    - run: npm test
```

Linha a linha:

- **`runs-on: ubuntu-latest`**: uma máquina Linux nova, do GitHub. Nunca é a mesma máquina duas vezes; tudo o que não vier do `checkout` ou de uma *action* desaparece no fim.
- **`timeout-minutes: 10`**: se o job ainda estiver a correr aos 10 minutos, é morto. Sem isto, um teste pendurado (lembras-te do Kafka sem timeout, módulo 16?) consumiria minutos gratuitos até ao limite da conta, à espera de nada.
- **`defaults.run.working-directory`**: todos os `run:` deste job correm dentro de `src/api`, sem teres de repetir `cd src/api &&` em cada linha.
- **`actions/checkout@v4`**: o primeiro passo de **quase todo** o job em **todo** o GitHub Actions. O runner nasce vazio; este step clona o teu repositório, no commit exato que disparou o workflow, para dentro da máquina.
- **`actions/setup-node@v4`**: instala o Node 22 **nesta máquina**, e `cache: npm` guarda a pasta `~/.npm` entre execuções (identificada pelo hash do `package-lock.json` indicado em `cache-dependency-path`). Sem isto, cada execução descarregava as dependências do zero.
- **`npm ci`** (não `npm install`): instala exatamente o que está no lock file. Se o lock file estiver desalinhado com o `package.json`, falha — de propósito, porque é um sinal de que alguém editou um sem atualizar o outro.
- **`npm run lint` / `npm test`**: os mesmos comandos que correste à mão nos módulos anteriores. **O CI não inventa verificações novas** — só corre, de forma automática e isolada, os comandos que já tens.

Os jobs `worker`, `web` e `activity` seguem o mesmo padrão, trocando `setup-node` por `setup-java` + `cache: maven` no caso do `activity` (módulo 17).

## 6. `needs`: ordenar jobs

```yaml
integration:
  needs: api
smoke:
  needs: [api, worker, activity, web, integration]
```

Sem `needs`, **todos** os jobs correm em paralelo, ao mesmo tempo, em máquinas diferentes — é o comportamento por omissão, e é bom para rapidez. Usamos `needs` só onde há uma razão:

- `integration` só corre depois de `api` passar: se os testes unitários (rápidos, baratos) já falharam, não vale a pena esperar por um Postgres (módulo mais lento) para descobrir o mesmo problema.
- `smoke` só corre depois de **tudo** passar: construir e arrancar seis contentores só para descobrir que o `build` do frontend tinha um erro de sintaxe seria desperdiçar minutos.

**Trade-off:** mais `needs` = pipeline mais lento (tudo em série) mas mais barato. Menos `needs` = feedback mais rápido mas podes gastar minutos em jobs cujo resultado já sabias que não importava.

## 7. `services`: contentores ao lado do job

```yaml
integration:
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_DB: workshop_test
      ports:
        - 5432:5432
      options: --health-cmd "pg_isready -U workshop" ...
```

O GitHub Actions sabe arrancar **contentores Docker ao lado do job**, na mesma rede, antes de o primeiro `step` correr. É a versão do GitHub Actions para "preciso de uma BD só para os testes", sem teres de instalar Postgres na máquina do runner nem escrever um `docker compose` à parte. O `options` com `health-cmd` é o mesmo conceito do `healthcheck` no nosso `docker-compose.yml` (módulo 02): o job só avança quando o Postgres responde.

Isto é diferente de `docker compose` (secção seguinte): `services:` é nativo do GitHub Actions e só serve o job onde está declarado; `docker compose` é o nosso próprio ficheiro, que corre como um comando normal dentro do job.

## 8. O job `smoke`: Docker dentro do runner

```yaml
run: docker compose -f config/docker-compose.yml up -d --build --wait web api worker activity keycloak
```

Os runners `ubuntu-latest` já vêm com **Docker instalado e a correr**. É por isso que conseguimos usar o mesmo `docker-compose.yml` que usas na tua máquina, sem o reescrever para o CI. A única adaptação foi a lista explícita de serviços (em vez de subir os 14): o runner tem menos recursos do que gostaríamos, por isso só sobe o que o `smoke-test.sh` e os E2E realmente precisam. O módulo 18 explica porque o Grafana e o Prometheus ficam de fora.

```yaml
- name: Libertar espaço em disco
  run: |
    sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /opt/hostedtoolcache/CodeQL || true
    docker image prune -af || true
```

Os runners gratuitos têm pouco disco livre, e vêm pré-instalados com toolchains que este pipeline nunca usa (.NET, Android, Haskell). Removê-las abre espaço para as imagens Docker de que precisamos (Postgres, Redis, RabbitMQ, Keycloak, Kafka, e as 4 imagens que construímos). O `|| true` no fim de cada comando evita que o step falhe se algum desses caminhos já não existir numa imagem de runner futura — é defensivo, não silencia um erro que importe.

## 9. `if: failure()` e `if: always()`

```yaml
- name: Guardar traces do Playwright em caso de falha
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-traces
    path: tests/e2e/test-results/

- name: Limpar
  if: always()
  run: docker compose -f config/docker-compose.yml down -v
```

Por omissão, se um `step` falhar, o GitHub Actions **salta todos os seguintes** e marca o job como falhado. Isto seria mau para o "Limpar": se o teste de fumo falhasse, os contentores ficavam a correr, consumindo o resto do tempo do job até ao `timeout-minutes` ou ao limite da conta.

- **`if: failure()`**: só corre se algum step anterior falhou. Usamos para guardar os *traces* do Playwright (módulo 08), que só interessam quando algo correu mal.
- **`if: always()`**: corre sempre, mesmo que tudo tenha falhado. Usamos para o `docker compose down -v`: limpar é obrigatório, sucesso ou não.

**Artefactos (`upload-artifact`):** ficheiros que o job produz e que queres **guardar** depois de a máquina ser destruída. Aparecem na página da execução, para descarregar. Sem isto, um teste E2E que falhou no CI seria uma caixa negra — com isto, descarregas o `trace.zip` e corres `npx playwright show-trace` na tua máquina, exatamente como farias localmente.

## 10. O que falta para ser CD (não só CI)

Este pipeline **termina nos testes**. Para teres entrega/deploy contínuo, acrescentarias um job novo, a seguir ao `smoke`:

```yaml
deploy:
  needs: smoke
  if: github.ref == 'refs/heads/main'   # só publicar a partir do main, nunca de um PR
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write          # para publicar no GitHub Container Registry
    id-token: write           # para autenticação OIDC (ver abaixo), sem segredos de longa duração
  steps:
    - uses: actions/checkout@v4
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - run: docker build -t ghcr.io/${{ github.repository }}/api:${{ github.sha }} src/api
    - run: docker push ghcr.io/${{ github.repository }}/api:${{ github.sha }}
    # Depois: atualizar config/k8s/api.yaml com esta tag e fazer "kubectl apply" (módulo 05 do K8s),
    # ou um "docker compose pull && up -d" num servidor, ou um passo do Argo CD/Flux (módulo 15).
```

**`secrets.GITHUB_TOKEN`:** um token automático, criado e destruído pelo próprio GitHub Actions a cada execução — nunca o escreves tu. Para segredos **teus** (uma chave de API de uma cloud, por exemplo), usa **Settings → Secrets and variables → Actions** no repositório, e lê-os com `${{ secrets.NOME }}`. Nunca aparecem nos logs (o GitHub oculta-os automaticamente, mesmo que os imprimas por engano).

**OIDC em vez de segredos de longa duração:** repara no `id-token: write`. É a mesma ideia do Keycloak (módulo 14): em vez de guardares uma password ou uma chave da AWS/Azure como secret (que nunca expira e é um alvo permanente), o GitHub Actions emite um **token de curta duração**, assinado, que a cloud verifica (com o mesmo mecanismo de chaves públicas do OIDC) antes de autorizar o deploy. Isto é hoje a prática recomendada para dar a um pipeline de CI acesso a uma cloud.

## 11. Minutos, custo e cache

- **Repositórios privados** (como o teu fork): minutos gratuitos limitados por mês, consumidos pelo tempo total de todos os jobs. **Repositórios públicos**: minutos ilimitados nos runners padrão do GitHub.
- É por isto que este pipeline tem `timeout-minutes` em todos os jobs, cache do npm e do Maven, `needs` a evitar trabalho desperdiçado, e o job `smoke` a subir só os serviços necessários. Cada minuto poupado é, literalmente, dinheiro ou quota poupada.
- `actions/cache` (usado por dentro do `setup-node`/`setup-java` com `cache: npm`/`cache: maven`) também existe como action independente (`actions/cache@v4`), para casos sem um `setup-*` dedicado — por exemplo, cache de camadas Docker com `docker/build-push-action` e `cache-from`/`cache-to: type=gha`.

## 12. Validar sem gastar minutos: `actionlint` e `act`

Antes de fazeres push, há duas formas de apanhar erros **sem** consumir minutos do GitHub:

```bash
# actionlint: valida a SINTAXE do workflow (YAML, referências a contextos, tipos). Não executa nada.
pip install actionlint-py && actionlint .github/workflows/ci.yml

# act: executa os jobs A SÉRIO, em Docker, na tua máquina. É o mais parecido com "correr no GitHub".
# (Precisa de Docker a funcionar; jobs com "services:" ou com docker-compose dentro exigem mais RAM.)
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
act -j api        # corre só o job "api", localmente
```

Foi assim que validámos este workflow ao escrevê-lo: com `actionlint` sempre, e manualmente (correndo os mesmos comandos que cada `run:` executa) quando `act` não estava disponível. **Nenhum dos dois substitui ver o workflow a correr no GitHub a sério** — só reduzem a probabilidade de a primeira tentativa falhar.

## 13. Branch protection: tornar o CI obrigatório

Um workflow que corre mas que ninguém é **obrigado** a respeitar não protege nada. Em **Settings → Branches → Branch protection rules** do teu fork, podes exigir que os jobs do CI passem antes de um PR poder ser *merged* no `main`. É o que transforma "temos testes" em "é impossível mergear código que não passa os testes" — a diferença entre ter um alarme e ligá-lo.

---

## Experiências

1. **Vê uma execução a sério:** depois do teu próximo push, vai a `https://github.com/<o-teu-utilizador>/Claude-Workshop/actions` e abre a execução. Expande um job e lê os logs de cada step — são exatamente os comandos deste módulo.
2. **Faz um job falhar de propósito:** no teu fork, parte um teste da API (como no módulo 10) e faz push num branch. Abre um Pull Request e vê o CI a correr e a falhar no job `api`. Confirma que `integration` e `smoke` **nem chegam a arrancar** (por causa do `needs`).
3. **Mede o efeito da cache:** no separador Actions de uma execução, abre o step `setup-node` e repara em "Cache restored from key...". Depois muda uma dependência no `package.json` (sem atualizar o lock) e vê o `npm ci` falhar — é a proteção a funcionar.
4. **Timeout a sério:** adiciona temporariamente `sleep 700` a um `run:` do job `api` (que tem `timeout-minutes: 10`) e faz push. Confirma que o job é cancelado aos 10 minutos, com uma mensagem clara, em vez de ficar pendurado até ao limite por omissão. Desfaz a alteração.

## Perguntas de pensamento crítico

1. Porque é que o `smoke` tem `needs: [api, worker, activity, web, integration]` e não corre logo em paralelo com os outros?
2. Se quisesses correr os testes também no Windows e no macOS (não só Linux), o que mudarias no `runs-on`? E porque é que a maior parte dos projetos **não** o faz para todos os jobs?
3. Um colega quer pôr a password da BD de produção diretamente no `ci.yml`, "só para ser mais rápido a testar". O que respondes?

<details>
<summary>Respostas</summary>

1. Porque construir e arrancar seis contentores (incluindo uma JVM do Keycloak e do Kafka) é o passo mais lento e mais caro do pipeline. Só vale a pena pagar esse custo depois de se saber que o código compila, os testes unitários passam e a integração com uma BD real funciona — tudo coisas mais rápidas de verificar primeiro.
2. Usarias uma **matrix**: `strategy: matrix: os: [ubuntu-latest, windows-latest, macos-latest]` e `runs-on: ${{ matrix.os }}`, o que corre o mesmo job três vezes, uma por sistema. A maior parte dos projetos não o faz para tudo porque macOS e Windows são runners mais caros (consomem minutos a um multiplicador maior) e, para um backend que só corre em Linux em produção (como este), testar nos outros sistemas não traz garantia adicional que justifique o custo.
3. Que nunca se commitam segredos, mesmo "só para testar": o ficheiro fica no histórico do Git para sempre (mesmo que seja apagado depois), qualquer pessoa com acesso ao repositório lê-o, e um repositório privado pode tornar-se público por engano. A forma correta é um **Secret** do GitHub Actions (`${{ secrets.NOME }}`), nunca visível nos logs, e revogável sem reescrever código.
</details>
