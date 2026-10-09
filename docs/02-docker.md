# 02 · Docker

**Objetivo:** perceber o que é um contentor, como se constrói uma imagem, e como o Compose junta vários serviços numa rede.

**Ficheiros para ler primeiro:** `src/api/Dockerfile`, `src/web/Dockerfile`, `src/api/.dockerignore`, `config/docker-compose.yml`.

---

## 1. O problema que o Docker resolve

"Funciona no meu computador" é o problema clássico. Um programa depende de: versão do Node, versão do sistema operativo, bibliotecas do sistema, variáveis de ambiente, portas livres. O Docker **empacota** tudo isso num artefacto único e reproduzível.

## 2. Imagem vs contentor

Esta distinção é a mais importante do módulo.

- **Imagem** = um **modelo** imutável. Uma receita já cozinhada e congelada. Não está a correr.
- **Contentor** = uma **instância** de uma imagem **a correr**. Podes criar muitos contentores a partir da mesma imagem, como objetos a partir de uma classe.

```bash
docker images                         # imagens que existem no disco
docker ps                             # contentores a correr
docker ps -a                          # todos, incluindo os parados
```

Um contentor **não é uma VM**. Não tem um kernel próprio: partilha o kernel do host e isola processos, rede e sistema de ficheiros. Por isso arranca em milissegundos e é leve.

## 3. Camadas (layers) e cache

Cada instrução do Dockerfile cria uma **camada**. As camadas são empilhadas e **cada uma é cacheada**. Se uma camada não mudou, o Docker reutiliza-a.

Consequência: **a ordem das linhas é uma decisão de desempenho.** Lê o `src/api/Dockerfile`:

```dockerfile
COPY package.json package-lock.json ./   # muda raramente
RUN npm ci --omit=dev                    # cara (minutos) — só repete se as dependências mudarem
COPY src ./src                           # muda a cada commit — fica no fim
```

Se puséssemos `COPY . .` antes do `npm ci`, **qualquer** alteração num ficheiro de código invalidaria a camada das dependências, e o `npm ci` correria sempre de novo.

**Experiência:** altera uma linha em `src/api/src/config.js` e corre `docker compose -f config/docker-compose.yml build api`. Repara que as camadas de `npm ci` aparecem com `CACHED`. Depois altera o `package.json` e compara.

## 4. Anatomia do Dockerfile da API

```dockerfile
FROM node:22-alpine      # imagem base: Node 22 sobre Alpine Linux (pequena)
WORKDIR /app             # pasta de trabalho dentro do contentor (cria-a se não existir)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev    # executa um comando DURANTE o build (cria uma camada)
COPY src ./src
USER node                # não correr como root
EXPOSE 3000              # documentação: a porta que a app usa (não abre nada por si só)
CMD ["node", "src/index.js"]   # comando que corre QUANDO o contentor arranca
```

Diferenças que tens de dominar:

| Instrução | Quando corre | Cria camada? |
|---|---|---|
| `RUN` | durante o **build** | sim |
| `CMD` | quando o **contentor arranca** | não |
| `ENTRYPOINT` | quando arranca (mais "fixo" que CMD) | não |

**Porque é que `npm ci` e não `npm install`?** `ci` instala **exatamente** o que está no `package-lock.json` e falha se não estiver sincronizado. Num build queremos reprodutibilidade, não "uma versão parecida".

**Porque `--omit=dev`?** As devDependencies (ferramentas de teste, por exemplo) não são precisas em produção. Menos código = imagem menor = menos superfície de ataque.

**Porque `USER node`?** Por omissão, o processo corre como `root` **dentro** do contentor. Se alguém explorar a aplicação, ganha root no contentor. Com `USER node` o dano fica limitado.

## 5. `.dockerignore`

Antes de enviar o contexto de build ao daemon, o Docker aplica o `.dockerignore`. Sem ele, `node_modules` do teu Mac/Linux (com binários compilados para outro sistema) iria para a imagem e podia partir tudo. Ignora também `.git`, segredos (`.env`) e ficheiros de teste se não forem necessários.

## 6. Multi-stage build: o frontend

O `src/web/Dockerfile` tem **dois** `FROM`:

```dockerfile
FROM node:22-alpine AS build     # estágio 1: compilar (precisa de Node e do Vite)
...
FROM nginx:1.27-alpine           # estágio 2: imagem final
COPY --from=build /app/dist /usr/share/nginx/html
```

O estágio 1 é descartado. Só os ficheiros `dist/` (HTML, JS, CSS compilados) passam para a imagem final. Resultado: a imagem final **não tem Node, nem npm, nem código-fonte**. Compara os tamanhos:

```bash
docker images | grep workshop
```

**Pergunta:** porque é que o React não precisa de Node **em runtime**, se o Node é o que corre a API?

<details>
<summary>Resposta</summary>

O React é compilado para ficheiros estáticos (HTML/JS/CSS) no build. Quem executa o JavaScript é o **browser** do utilizador. O Nginx só entrega ficheiros. O Node é necessário apenas para compilar, por isso fica no estágio de build.
</details>

## 7. Compose: vários contentores, uma rede

O `docker-compose.yml` descreve **vários** serviços. Compose cria automaticamente:

- **Uma rede privada** onde os serviços se veem pelo **nome**. Por isso `DATABASE_URL` usa `postgres:5432` e não `localhost:5432`. Dentro do contentor da API, `localhost` é o próprio contentor.
- **DNS interno**: `api` resolve para o IP do contentor da API. É isto que o Nginx usa em `proxy_pass http://api:3000`.
- **Volumes** nomeados (`pgdata`): os dados da BD sobrevivem a `docker compose down`. Só `down -v` os apaga.

Repara no que **não** tem `ports:`: `api`, `worker`, `postgres`, `redis`. Não são acessíveis do host. Esta é a forma de **reduzir a superfície de exposição**: só o que precisa de ser público é publicado.

**Experiência:**

```bash
# Consegues aceder à API diretamente do host? (Deve falhar: não há ports:)
curl localhost:3000/api/health

# Mas de dentro da rede sim:
docker compose -f config/docker-compose.yml exec web wget -qO- http://api:3000/api/health
```

## 8. `depends_on` não é "esperar que esteja pronto"

Esta é uma das armadilhas mais comuns.

```yaml
depends_on:
  postgres:
    condition: service_healthy   # espera pelo HEALTHCHECK
```

- `depends_on` **simples** só garante que o contentor **arrancou**. O Postgres ainda pode estar a inicializar a base de dados durante 5 segundos.
- `condition: service_healthy` espera que o **healthcheck** passe.

Cada serviço define o seu healthcheck, por exemplo `pg_isready` para o Postgres. Sem healthcheck, `service_healthy` não funciona.

**Pergunta:** se o healthcheck da API for removido, o que acontece quando o `worker` arranca? E o `web`?

<details>
<summary>Resposta</summary>

Sem healthcheck, o `depends_on` com `service_healthy` falha ou não espera. O `worker` pode arrancar e tentar consumir antes de a API ter corrido as migrações, e o `web` pode arrancar antes de a API aceitar ligações. O Nginx chega a falhar no arranque com `host not found in upstream "api"` se o nome ainda não estiver resolvido. Experimenta.
</details>

## 9. `restart` e o que o Docker faz quando um processo morre

`restart: unless-stopped` diz ao Docker: "se o processo principal terminar com erro, volta a arrancá-lo". É a rede de segurança para falhas transitórias (ex.: a BD reiniciou). Repara que `process.exit(1)` nos `index.js` é o que sinaliza a falha ao Docker. Se o processo saísse com código `0`, o Docker não o reiniciaria.

## 10. Comandos essenciais

```bash
C="docker compose -f config/docker-compose.yml"

$C up --build -d          # construir (se preciso) e arrancar em segundo plano
$C ps                     # estado de cada serviço (repara na coluna HEALTH)
$C logs -f api            # seguir logs de um serviço
$C exec postgres psql -U workshop -d workshop   # abrir a consola SQL dentro do contentor
$C restart worker         # reiniciar um serviço
$C stop rabbitmq          # parar um serviço (sem o remover)
$C down                   # parar e remover contentores e rede (mantém volumes)
$C down -v                # ... e apagar volumes (APAGA OS DADOS)
$C build --no-cache api   # reconstruir ignorando a cache
```

---

## Experiências guiadas

1. **Cache de camadas:** faz `build` duas vezes seguidas. Na segunda, tudo deve estar `CACHED`.
2. **Dados persistentes:** cria uma tarefa, faz `down` e depois `up`. A tarefa continua lá? Agora faz `down -v` e `up`. E agora?
3. **Imagem não-root:** `docker compose ... exec api whoami`. Deve responder `node`.
4. **Isolamento:** confirma com `curl localhost:3000` que a API não está exposta.

## Perguntas de pensamento crítico

1. Porque é que a imagem do `web` não tem o `.dockerignore` a excluir `dist`? E porque é que o `src/web/.dockerignore` o exclui?
2. Se amanhã o Node 24 sair e quiseres atualizar, quantas linhas mudas e o que é que pode partir?
3. Um colega diz: "vamos pôr a password da BD num `.env` commitado para não ter de configurar nada". O que dizes?

<details>
<summary>Resposta</summary>

1. O `dist` é gerado **dentro** do contentor de build, por isso não deve ser copiado do host (poderia estar desatualizado). O `.dockerignore` do `web` impede que um `dist/` antigo que existe na tua máquina entre no contexto de build.
2. Uma linha (`FROM node:24-alpine`). Pode partir: dependências nativas, mudanças de comportamento. Por isso se testa antes e se fixa a versão exata.
3. Não se commitam segredos. O `.env` vai no `.gitignore` e existe um `.env.example` sem valores reais. Para desenvolvimento local o valor fraco aqui é aceitável, mas o **hábito** é o que interessa.
</details>
