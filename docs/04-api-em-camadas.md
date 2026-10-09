# 04 · API em camadas

**Objetivo:** perceber porque separamos a API em camadas, o que cada camada pode e não pode fazer, e como as peças são **ligadas** no arranque.

**Ficheiros para ler (por esta ordem):** `src/api/src/index.js` → `app.js` → `routes/tasks.js` → `services/taskService.js` → `repositories/taskRepository.js`.

---

## 1. O mapa das camadas

```
HTTP  →  routes/tasks.js  →  services/taskService.js  →  repositories/taskRepository.js  →  Postgres
          (traduz)            (decide)                    (guarda)
                                   ↓
                          cache/cache.js → Redis
                          messaging/publisher.js → RabbitMQ
```

Cada camada tem **uma responsabilidade** e só conhece a camada de baixo **pela forma** que lhe é dada:

| Camada | Sabe de | **Não** sabe de |
|---|---|---|
| `routes` | HTTP, códigos de estado, `req`/`res` | regras de negócio, SQL |
| `services` | regras (cache, eventos, transições) | HTTP, SQL |
| `repositories` | SQL | HTTP, regras |

**Porque é que isto importa?** Porque cada camada pode mudar sem arrastar as outras. Trocar Express por Fastify só mexe em `routes`. Trocar Postgres por outra BD só mexe em `repositories`. E podes testar a regra de negócio (`services`) **sem** um servidor HTTP nem uma BD.

## 2. Composição: `index.js` é o único sítio que conhece tudo

Lê `index.js`. Repara no padrão:

```js
const service = createTaskService({
  repository: createTaskRepository(pool),
  cache: createCache(redis),
  publisher,
  cacheTtlSeconds: config.cacheTtlSeconds,
});
```

Isto é **injeção de dependências** (DI) em versão manual. O serviço **não** cria o Postgres nem o Redis: recebe-os. Em vez de:

```js
// ❌ acoplado: o serviço decide qual é a BD
async function createTask(title) {
  const pool = new pg.Pool(...);   // impossível de testar sem Postgres
}
```

fazemos:

```js
// ✅ o serviço só usa o que lhe dão
export function createTaskService({ repository, cache, publisher }) { ... }
```

**Vantagem prática:** nos testes, passamos versões falsas (fakes). Vê `test/taskService.test.js`: a BD é um `Map` em memória, e os testes correm em milissegundos.

**Pergunta:** porque é que `createTaskService` é uma **função que devolve um objeto** e não uma classe com `new`?

<details>
<summary>Resposta</summary>

Não é obrigatório, é um estilo. Uma função-fábrica (`createX`) evita `this` (que se perde facilmente em callbacks), e as dependências ficam numa **closure**, invisíveis de fora. A API pública é só o objeto que devolve. Ambos os estilos são válidos; o importante é ser consistente no projeto.
</details>

## 3. Routes: traduzir, não decidir

Lê `routes/tasks.js`. Uma rota típica tem quatro passos:

1. **Validar** a entrada (`safeParse` com zod).
2. **Chamar** o serviço.
3. **Traduzir** o resultado em HTTP (`201`, `404`).
4. **Enviar** a resposta.

Repara no `PATCH`:

```js
const task = await service.updateTask(id, parsed.data.done);
if (!task) throw new HttpError(404, 'Tarefa não encontrada');
```

A rota **não sabe** porque é que a tarefa não existe. O serviço devolve `null`, a rota decide que isso é um `404`. Se amanhã o serviço lançar uma exceção própria, só a tradução muda.

## 4. Validação: na fronteira, uma vez

`validation/taskSchemas.js` define **o contrato** do que aceitamos:

```js
title: z.string().trim().min(1).max(200)
```

Três coisas a notar:

- **`.trim()` antes de `.min(1)`**: `"   "` passa como vazio. A ordem das regras importa.
- **`z.coerce.number()`** para o `:id` da URL: os parâmetros de URL chegam sempre como string. `coerce` converte e valida numa só operação.
- **`safeParse`** em vez de `parse`: não lança exceção, devolve `{ success, data | error }`. Mais fácil de tratar.

**Porque validar se a BD já tem `CHECK`?** Defesa em profundidade. A BD protege os dados; a validação na API dá uma **mensagem de erro útil** (`400` com texto legível) em vez de um erro SQL cru (`500`). São camadas diferentes com propósitos diferentes.

## 5. Erros: uma só forma de os devolver

Lê `middleware/errorHandler.js`. Há dois tipos de erro:

- **Esperados** (`HttpError(404, ...)`): o cliente fez algo que não podia. Devolvemos a mensagem.
- **Inesperados** (qualquer outro): bugs ou infraestrutura. Registamos o stack trace e devolvemos `500` genérico.

Isto mantém a API **previsível**: todos os erros têm o formato `{ "error": "..." }`.

## 6. `app.js` vs `index.js`: separar a construção do arranque

`createApp` **constrói** a aplicação Express (sem a pôr a escutar). `index.js` **arranca** o processo: liga BD, Redis, RabbitMQ, faz `listen` e trata do `SIGTERM`.

Porquê a separação? Os testes de rotas (`test/routes.test.js`) importam `createApp`, mas **não** importam `index.js`. Se o código de arranque estivesse no mesmo ficheiro, importar a app para um teste tentaria ligar-se a infraestrutura.

## 7. Encerramento gracioso (graceful shutdown)

Quando fazes `docker stop`, o Docker envia `SIGTERM` e espera uns segundos antes de enviar `SIGKILL`. Se não tratares `SIGTERM`:

- Pedidos a meio são cortados.
- Ligações ficam abertas no servidor da BD.

`index.js` trata o sinal: `server.close()` deixa de aceitar pedidos novos, espera pelos atuais, e só depois fecha a BD e sai com `process.exit(0)`.

**Experiência:** `time docker compose ... stop api` e depois `docker compose ... logs api | tail`. Vê a mensagem `SIGTERM recebido, a encerrar`.

---

## Experiências

1. Adiciona um campo que não existe ao corpo: `curl -X POST ... -d '{"title":"a","foo":1}'`. O zod ignora campos desconhecidos por omissão. É bom ou mau? Pensa no que acontece se um cliente enviar `"done": true` a `POST` (a criação)?
2. Muda a mensagem de erro em `taskSchemas.js` e corre `npm test` em `src/api`. O teste que a verifica (`/obrigatório/`) reage? Porque é que um teste a verificar texto exato pode ser frágil?

## Perguntas de pensamento crítico

1. Se o `repository.create` falhar **depois** de o `cache.del` ter sido chamado, o que é que os clientes veem? (Pista: a ordem das linhas em `createTask`.)
2. A regra "só publicar na transição false → true" está no serviço. Porque **não** na rota? Porque **não** na BD (um trigger)?
3. Um colega quer importar `taskRepository` diretamente numa rota "para ser mais rápido". Que argumento usas para o convencer a não o fazer?

<details>
<summary>Resposta</summary>

1. Na ordem atual, o `create` falha antes do `del`, por isso a cache não é tocada e continua correta. Se a ordem fosse inversa, a cache era apagada e o `create` falhava, e a próxima leitura voltava a encher a cache com dados iguais: inofensivo aqui, mas o raciocínio "apaga a cache depois de escrever" é o correto (módulo 05).
2. É uma **regra de negócio**. Na rota, ficava acoplada ao HTTP e não era testável sem servidor. Na BD (trigger), ficava invisível para quem lê o código da aplicação e seria difícil de testar e de versionar. Há casos em que um trigger é a escolha certa (garantias que a aplicação não pode dar), mas não aqui.
3. Quando a rota fala com a BD diretamente, a regra "invalidar cache" e "publicar evento" têm de ser **copiadas** para cada rota. Quando alguém se esquece numa delas, o sistema fica inconsistente sem nenhum erro visível. A camada de serviço existe precisamente para que estas regras estejam num único sítio.
</details>
