# 01 · Fundamentos

**Objetivo:** perceber o que acontece quando clicas num botão, do browser até à BD e de volta.

**Ficheiros para ler primeiro:** `src/api/src/app.js`, `src/api/src/routes/tasks.js`, `src/web/src/api.js`.

---

## 1. Cliente e servidor

Uma aplicação web é um **cliente** que pede e um **servidor** que responde.

- O **cliente** (o browser, com o código React) pede coisas: "dá-me as tarefas".
- O **servidor** (a API Express) decide e responde: "aqui estão, em JSON".

Quem executa o código **não** é quem o escreveu. O browser executa o JavaScript que o servidor (Nginx) lhe entrega. O servidor da API executa o Node.js no teu computador (ou no contentor).

## 2. HTTP: a linguagem da conversa

Um pedido HTTP tem:

```
PATCH /api/tasks/3 HTTP/1.1          ← método + caminho
Host: localhost:8080                 ← cabeçalhos (metadados)
Content-Type: application/json

{"done": true}                       ← corpo (payload)
```

A resposta tem um **código de estado**, cabeçalhos e corpo:

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: MISS

{"id":3,"title":"Estudar Docker","done":true,...}
```

Códigos que vais ver neste projeto:

| Código | Significado | Onde acontece |
|---|---|---|
| 200 | OK | `GET /api/tasks`, `PATCH` |
| 201 | Criado | `POST /api/tasks` |
| 204 | Sucesso sem corpo | `DELETE` |
| 400 | Pedido inválido (culpa do cliente) | validação com zod |
| 404 | Não existe | id desconhecido, rota desconhecida |
| 500 | Erro do servidor (culpa nossa) | bugs, BD em baixo |
| 503 | Serviço indisponível | `/api/health` quando uma dependência falha |

**Pergunta:** porque é que `POST` devolve `201` e não `200`? E porque é que a rota de apagar devolve `204`?

<details>
<summary>Resposta</summary>

`201` indica que um **recurso novo foi criado** (e idealmente o cabeçalho `Location` aponta para ele). `204` indica sucesso **sem corpo**, porque não há nada para devolver depois de apagar. Usar os códigos certos permite que o cliente e as ferramentas (proxies, monitorização) percebam o que aconteceu sem ler o corpo.
</details>

## 3. REST: convenções sobre HTTP

REST é um **estilo** de desenhar APIs à volta de **recursos** (substantivos) e **métodos** (verbos HTTP):

| Ação | Método | Caminho |
|---|---|---|
| listar tarefas | `GET` | `/api/tasks` |
| criar | `POST` | `/api/tasks` |
| alterar uma | `PATCH` | `/api/tasks/:id` |
| apagar uma | `DELETE` | `/api/tasks/:id` |

Diferença entre `PUT` e `PATCH`: `PUT` substitui o recurso inteiro; `PATCH` altera só os campos enviados. Por isso usamos `PATCH` com `{ "done": true }`.

**Idempotência de métodos HTTP** (não confundir com a idempotência do worker, módulo 07): `GET`, `PUT` e `DELETE` são idempotentes por definição (repetir não muda o resultado final). `POST` não é. Esta distinção vai importar quando falarmos de retries.

## 4. JSON e a fronteira

JSON é o formato de troca. Quando a API recebe `req.body`, **não sabe o que lá está**. Tudo o que vem do exterior é suspeito. Por isso validamos com zod (`src/api/src/validation/taskSchemas.js`) antes de tocar em qualquer lógica.

## 5. Processos, portas e variáveis de ambiente

- Um **processo** é um programa a correr. `node src/index.js` cria um processo.
- Uma **porta** é um número que identifica um serviço numa máquina. A API escuta na `3000`; o Nginx na `80` (exposta como `8080` no host).
- Uma **variável de ambiente** é configuração que vem de fora do código: `DATABASE_URL`, `REDIS_URL`. Lê-las em `src/api/src/config.js` permite a **mesma imagem** correr em ambientes diferentes.

Porque é que a password não está no código? Porque o código vai para o Git e as passwords não. Repara que no `docker-compose.yml` a password aparece, e isso é um **compromisso aceitável só para desenvolvimento local**. Em produção vem de um cofre de segredos.

## 6. Node.js e o event loop

Node executa JavaScript numa **única thread**. Para não bloquear, todas as operações de I/O (BD, rede, disco) são **assíncronas**: pedem algo e o event loop continua a tratar outros pedidos enquanto espera.

```js
// Isto NÃO bloqueia o servidor: enquanto a BD responde, outros pedidos são atendidos.
const { rows } = await pool.query('SELECT ...');
```

Consequência prática: **nunca** faças trabalho CPU-intensivo (ex.: um loop gigante) dentro de um pedido HTTP. Bloqueia **todos** os utilizadores. É um dos motivos para existir um **worker** separado (módulo 07).

## 7. Express: o pipeline de middlewares

Um pedido atravessa uma **cadeia** de funções. Cada uma recebe `(req, res, next)`:

```
pedido → express.json() → /api/health? → rotas /api/* → notFound → errorHandler
```

Lê `src/api/src/app.js`. A ordem **importa**:

- `express.json()` tem de estar **antes** das rotas, senão `req.body` está vazio.
- `notFound` e `errorHandler` estão **no fim**. Um erro salta por cima dos middlewares normais até encontrar um com **4 parâmetros** `(err, req, res, next)`.

Express 5 trata erros lançados em funções `async` automaticamente. Repara que as rotas em `routes/tasks.js` lançam `HttpError` sem `try/catch`. Em Express 4 isto **não** funcionava, e é a razão pela qual vais ver código antigo com `try/catch` em todo o lado.

---

## Experiências

1. Faz um pedido à mão e lê a resposta completa:
   ```bash
   curl -i http://localhost:8080/api/tasks
   ```
2. Pede uma rota que não existe e repara no corpo do erro: `curl -i http://localhost:8080/api/nada`.
3. Envia JSON inválido: `curl -i -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{isto'`. Quem devolve esta resposta? Procura a resposta no código: é o `body-parser` (dentro do `express.json()`) a lançar um erro com `status 400`, que o `errorHandler` transforma em JSON.

## Perguntas de pensamento crítico

1. Se a API demorar 2 segundos a responder à BD, o que acontece aos outros utilizadores? Porquê?
2. Porque é que `errorHandler` esconde a mensagem de erro quando `status >= 500`?
3. Um cliente envia `PATCH /api/tasks/1` duas vezes com `{"done": true}`. O estado final muda? E o número de eventos publicados? (Responde antes de ver o módulo 04.)

<details>
<summary>Resposta</summary>

1. Nada, porque o Node não bloqueia durante I/O: o `await` liberta o event loop. Só ficam lentos se a BD estiver lenta ou se houver trabalho CPU pesado no meio do pedido.
2. Mensagens de erro internas (SQL, caminhos de ficheiros, stack traces) são informação útil para um atacante. Registamo-las no **servidor** (`console.error`) e devolvemos ao cliente uma mensagem genérica.
3. O estado final não muda (é idempotente). O número de eventos **também não** deve mudar: `updateTask` só publica quando há transição `false → true`. Repara que a verificação está no serviço, não na rota, porque é uma regra de negócio.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 01`.

**1.** Qual destes códigos HTTP significa 'recurso criado com sucesso' (ex.: POST /api/tasks)?

- a) 200 OK
- b) 201 Created
- c) 204 No Content
- d) 202 Accepted

<details><summary>Resposta</summary>

**b) 201 Created** — POST que cria um recurso novo responde 201, não 200.

</details>

**2.** Porque é que DELETE devolve 204 e não 200?

- a) Porque apagar falha sempre
- b) Porque não há corpo para devolver depois de apagar: 204 = sucesso sem corpo
- c) É mais rápido responder 204
- d) O Express exige 204 em DELETE

<details><summary>Resposta</summary>

**b) Porque não há corpo para devolver depois de apagar: 204 = sucesso sem corpo** — 204 No Content é o código certo quando a operação teve sucesso mas não há nada para devolver.

</details>

**3.** Porque é que o Node não bloqueia todos os utilizadores enquanto espera a resposta da BD?

- a) Porque usa várias threads para cada pedido
- b) Porque as operações de I/O são assíncronas e libertam o event loop enquanto esperam
- c) Porque o Postgres é sempre rápido
- d) Porque o Express faz cache automática

<details><summary>Resposta</summary>

**b) Porque as operações de I/O são assíncronas e libertam o event loop enquanto esperam** — O Node é single-threaded, mas o await liberta o event loop durante o I/O, para atender outros pedidos.

</details>

**4.** No Express, o que torna uma função reconhecível como middleware de ERRO?

- a) Ser declarada com async
- b) Ter 4 parâmetros: (err, req, res, next)
- c) Chamar-se errorHandler
- d) Estar no topo do ficheiro

<details><summary>Resposta</summary>

**b) Ter 4 parâmetros: (err, req, res, next)** — O Express reconhece um middleware de erro pela assinatura com 4 parâmetros, não pelo nome.

</details>

**5.** Que método HTTP altera só os campos enviados, sem substituir o recurso inteiro?

<details><summary>Resposta</summary>

**patch** — PATCH altera parcialmente; PUT substituiria o recurso inteiro.

</details>

<!-- quiz:end -->
