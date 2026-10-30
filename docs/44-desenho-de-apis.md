# 44 · Desenho de APIs

**Objetivo:** desenhar APIs HTTP que os clientes conseguem usar bem e que conseguem evoluir sem os partir: recursos e métodos, erros num formato padrão (RFC 9457), paginação por cursor, versões e mudanças compatíveis, e atualizações concorrentes seguras com `If-Match` e *merge patch*.

**Ficheiros para ler:** `src/api/openapi.yaml` (o contrato da API do workshop) e `src/api/src/routes/tasks.js`.

**Pré-requisitos:** módulos 01 (HTTP e REST), 04 (API em camadas) e 43 (cache HTTP: ETags).

---

## 1. Uma API é um produto (e um contrato)

Uma API pública, ou usada por outras equipas, é muito mais difícil de mudar do que o código por trás dela: cada decisão (um nome de campo, o formato de um erro, como se pagina) fica congelada no momento em que o primeiro cliente a usa. Por isso vale a pena pensar no desenho **antes**, e muitas equipas escrevem primeiro o contrato (o OpenAPI, como o `openapi.yaml` do workshop: *design-first*) e só depois o código. Os guias de estilo públicos da Google (AIP), da Microsoft e da Zalando são boas leituras.

## 2. Recursos, métodos e códigos

O módulo 01 apresentou o REST. Os detalhes que distinguem uma API cuidada:

- **Recursos com substantivos no plural** (`/tarefas`, `/tarefas/42/comentarios`), não verbos (`/criarTarefa`). Ações que não são CRUD viram sub-recursos ou ações explícitas (`POST /tarefas/42/arquivar`).
- **Os métodos pelo que significam**: `GET` (seguro, sem efeitos), `PUT` (substitui, idempotente), `PATCH` (altera em parte), `DELETE` (idempotente), `POST` (cria ou ação; não idempotente, por isso pede uma chave de idempotência, módulo 54).
- **Os códigos certos**: `201 Created` com `Location`, `204 No Content`, `400` (pedido malformado), `401` vs `403` (módulo 15), `404`, `409 Conflict`, `412`/`428` (pré-condições, secção 6), `422` (dados com a forma certa mas inválidos), `429` com `Retry-After`.
- **Nomes e formatos consistentes**: o mesmo estilo em todos os campos (`criadaEm` ou `criada_em`, nunca os dois), datas em ISO 8601 com fuso, dinheiro em cêntimos com a moeda (módulo 54), ids como texto (para poderem mudar de formato).

## 3. Erros: Problem Details

Se cada rota inventar o seu formato de erro (`{ error: ... }`, `{ message: ... }`, `{ errors: [...] }`), cada cliente tem de tratar todos. O **RFC 9457** (*Problem Details for HTTP APIs*, que substituiu o 7807) define um formato padrão, com o tipo `application/problem+json`:

```json
{
  "type": "https://tarefas.pt/problemas/validacao",
  "title": "Dados inválidos",
  "status": 422,
  "detail": "O título é obrigatório",
  "instance": "/api/tasks",
  "errors": [{ "campo": "titulo", "mensagem": "obrigatório" }]
}
```

O `type` identifica o tipo de problema (e pode ser um URL para a documentação), o `title` é o resumo legível, o `detail` a explicação desta ocorrência, e podem acrescentar-se extensões (como a lista `errors`). E uma regra de segurança: **um erro inesperado (500) nunca devolve a mensagem interna** (SQL, caminhos, nomes de tabelas): regista-a nos logs (com o id do pedido, módulo 47) e devolve só "erro interno".

## 4. Paginação

Uma listagem sem paginação funciona até ao dia em que há 100 000 tarefas. Há duas formas:

- **Por deslocamento** (`?limit=20&offset=40`): simples e permite saltar para a página 7, mas o `OFFSET` obriga o Postgres a ler e deitar fora todas as linhas anteriores (lento nas páginas fundas), e **não é estável**: se entrar uma tarefa nova entre dois pedidos, uma linha aparece duas vezes ou nunca.
- **Por cursor** (*keyset*): a resposta traz um `proximo` opaco, que codifica a posição da última linha (`criada_em` e `id`); o pedido seguinte pede "as que vêm depois desta": `WHERE (criada_em, id) < ($1, $2) ORDER BY criada_em DESC, id DESC LIMIT 21`. Usa um índice (módulo 36), é igualmente rápido em qualquer página, e é estável. O `id` na ordem desempata linhas com a mesma data. Pedir `limite + 1` linhas diz se há uma página seguinte, sem um `COUNT(*)` caro.

O cursor deve ser **opaco** (base64 de um JSON, por exemplo): o cliente não o interpreta, e assim pode mudar-se o formato. E o limite tem sempre um máximo.

## 5. Versões e evolução

Mudanças **compatíveis** (não partem os clientes existentes) fazem-se a qualquer momento: campos novos na resposta, campos novos **opcionais** no pedido, rotas novas. Mudanças **incompatíveis** (*breaking*) exigem uma versão nova: remover ou renomear um campo, mudar o tipo, tornar obrigatório um campo do pedido, e, o caso menos óbvio, **um valor novo num enum da resposta** (um cliente com um `switch` sobre o estado não sabe o que fazer com `"bloqueada"`). Por isso, quem consome uma API também deve ser tolerante: ignorar campos desconhecidos e ter um caso por omissão nos `switch` (o "princípio da robustez").

Onde pôr a versão:

- **no caminho** (`/v2/tarefas`): o mais visível e fácil de encaminhar e cachear; o mais comum;
- **num cabeçalho** (`API-Version: 2`) ou **no tipo de media** (`Accept: application/vnd.tarefas.v2+json`): URLs estáveis, mais "corretos" em REST, menos fáceis de testar no browser;
- **por data** (`Stripe-Version: 2026-09-30`): a Stripe guarda a versão de cada cliente e transforma as respostas de versão em versão.

Desligar uma versão faz-se com aviso: os cabeçalhos `Deprecation` e `Sunset` (RFC 8594) dizem aos clientes que a versão vai acabar e quando, e as métricas dizem quem ainda a usa. Por dentro, o padrão saudável é **um só modelo interno** e transformações para cada versão nas margens, nunca duas cópias da lógica de negócio. Os testes de contrato (módulo 58) apanham as quebras antes de chegarem aos clientes.

## 6. Escritas concorrentes

Duas pessoas abrem a mesma tarefa. A Ana muda o estado e guarda; o Rui muda o título (a partir da versão que leu antes) e guarda: com um `PUT` ingénuo, a mudança da Ana desaparece. É a **atualização perdida** (módulo 38). O HTTP tem a solução embutida, com o ETag do módulo 43:

- o `GET` devolve o `ETag` (a versão do recurso);
- o `PATCH`/`PUT` envia `If-Match: "<etag>"`; se o recurso mudou entretanto, o servidor responde **`412 Precondition Failed`**, e o cliente relê e tenta outra vez (ou mostra o conflito);
- o servidor pode **exigir** o `If-Match` com **`428 Precondition Required`**, para nenhum cliente se esquecer.

Para atualizações parciais, o **JSON Merge Patch** (RFC 7396, `application/merge-patch+json`) é o formato mais simples: um objeto com os campos a mudar, `null` para apagar, objetos aninhados juntam-se recursivamente. (Não consegue alterar um elemento de um array nem pôr um campo a `null`; para isso há o JSON Patch, RFC 6902, com operações explícitas.)

## 7. O resto do contrato

- **Documentação gerada do contrato** (o Swagger UI do workshop), com exemplos reais.
- **Limites** comunicados nos cabeçalhos (`RateLimit-Limit`, `RateLimit-Remaining`) e `429` com `Retry-After`.
- **Ids de pedido** em todas as respostas, para o suporte (módulo 47).
- **Webhooks** para avisar os clientes de mudanças, em vez de os obrigar a perguntar (módulo 54).
- E quando o REST não serve (consultas muito variáveis, chamadas entre serviços com muito tráfego), o GraphQL e o gRPC (módulo 46).

## Em resumo

- Uma API é um **contrato** difícil de mudar depois de ter clientes: desenha-se antes (de preferência no OpenAPI), com nomes, métodos e códigos consistentes.
- Os erros seguem um formato padrão, o ***Problem Details*** (RFC 9457), e um erro inesperado nunca revela detalhes internos.
- A **paginação por cursor** (*keyset*) é rápida em qualquer página e estável quando entram dados novos; o `OFFSET` não é nenhuma das duas coisas.
- Mudanças **compatíveis** fazem-se a qualquer momento; remover, renomear ou mudar o tipo de um campo (ou um valor novo num enum da resposta) exige uma **versão nova**, anunciada com `Deprecation` e `Sunset`.
- As escritas concorrentes protegem-se com o **ETag e `If-Match`** (412 se alguém mudou entretanto, 428 se o cliente não o enviou); o **JSON Merge Patch** é o formato mais simples para alterações parciais.

---

## Prática: escreve tu

As peças de uma API bem desenhada: erros no formato do RFC 9457 sem revelar detalhes internos, paginação por cursor num Postgres (estável quando entram linhas novas), negociação de versões com avisos de obsolescência e a regra do que parte os clientes, e um servidor HTTP com `If-Match` e JSON Merge Patch.

**Ficheiros:** `pratica/44-desenho-de-apis/` (`problemas.js`, `paginacao.js`, `versoes.js`, `concorrencia.js`)

**Verificar:** `npm run verificar 44` (dentro de `pratica/`). Só um exercício: `npm run verificar 44 problemas`, `... 44 paginacao`, `... 44 versoes` ou `... 44 concorrencia`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Problem Details (≈20 min)

**Ficheiro:** `problemas.js`

Transformar os erros da aplicação em respostas RFC 9457 (com a lista de erros de validação como extensão), sem nunca devolver a mensagem de um erro inesperado.

**Sintaxe que vais praticar:** `instanceof` com classes de erro próprias, uma classe que estende `Error` com um campo extra, `res.writeHead` com cabeçalhos.

<details>
<summary>Pista</summary>

Um `if`/`else if` por tipo de erro, do mais específico para o mais geral, a montar o corpo; o último `else` é o 500 genérico. Põe o `detail` só nos casos em que a mensagem é segura de mostrar.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Erros com um formato padrão: "Problem Details" (RFC 9457).

export class ErroValidacao extends Error {
  constructor(erros) {
    super('Dados inválidos');
    this.erros = erros; // [{ campo, mensagem }]
  }
}
export class NaoEncontrado extends Error {}
export class Conflito extends Error {}

// paraProblema(erro, { instancia }) → { status, corpo }
//   corpo segue o RFC 9457: { type, title, status, detail?, instance, ...extensões }
//   - ErroValidacao → 422, type 'https://tarefas.pt/problemas/validacao', title 'Dados inválidos',
//                     e a extensão errors: [{ campo, mensagem }] (os erros do objeto)
//   - NaoEncontrado → 404, type '.../nao-encontrado', title 'Não encontrado', detail = a mensagem do erro
//   - Conflito      → 409, type '.../conflito', title 'Conflito', detail = a mensagem
//   - outro erro    → 500, type 'about:blank', title 'Erro interno', SEM detail (a mensagem de um
//                     erro inesperado pode ter detalhes internos: SQL, caminhos, segredos)
//   instance: o caminho do pedido (vem nas opções)
//   Só incluas detail quando existe.
const BASE = 'https://tarefas.pt/problemas/';
export function paraProblema(erro, { instancia }) {
  let corpo;
  if (erro instanceof ErroValidacao) {
    corpo = { type: `${BASE}validacao`, title: 'Dados inválidos', status: 422, instance: instancia, errors: erro.erros };
  } else if (erro instanceof NaoEncontrado) {
    corpo = { type: `${BASE}nao-encontrado`, title: 'Não encontrado', status: 404, detail: erro.message, instance: instancia };
  } else if (erro instanceof Conflito) {
    corpo = { type: `${BASE}conflito`, title: 'Conflito', status: 409, detail: erro.message, instance: instancia };
  } else {
    corpo = { type: 'about:blank', title: 'Erro interno', status: 500, instance: instancia };
  }
  return { status: corpo.status, corpo };
}

// enviarProblema(res, erro, instancia): escreve a resposta num http.ServerResponse do Node, com
//   o estado, o Content-Type 'application/problem+json' e o corpo em JSON.
export function enviarProblema(res, erro, instancia) {
  const { status, corpo } = paraProblema(erro, { instancia });
  res.writeHead(status, { 'Content-Type': 'application/problem+json' });
  res.end(JSON.stringify(corpo));
}
```
</details>

### P2 · Paginação por cursor (≈30 min)

**Ficheiro:** `paginacao.js`

Cursores opacos (base64url de um JSON) com validação, e uma página com a comparação de tuplos `(criada_em, id) < (...)`, `limite + 1` linhas e o cursor seguinte.

**Sintaxe que vais praticar:** `Buffer.from(...).toString('base64url')`, `JSON.parse` dentro de `try/catch`, comparação de linhas no SQL (`(a, b) < ($1, $2)`), um parâmetro que pode ser `NULL` (`$1::timestamptz IS NULL OR ...`).

<details>
<summary>Pista</summary>

Pede uma linha a mais do que o limite. Se ela vier, há uma página seguinte, e o cursor é feito a partir da **última linha que devolves** (não da que sobrou). Guarda a data no cursor com `toISOString()`, para não perderes os milissegundos nem o fuso.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Paginação por cursor (keyset): estável e rápida, ao contrário do OFFSET.
// Tabela (criada pelos testes): tarefas(id int, titulo text, criada_em timestamptz)
// Ordem: as mais recentes primeiro (criada_em DESC), com o id a desempatar (id DESC).

export class ErroCursor extends Error {}

// codificarCursor({ criadaEm, id }) → texto base64url do JSON { c: criadaEm, i: id }
// descodificarCursor(texto) → { criadaEm, id }, ou lança ErroCursor se não for um cursor válido
//   (não descodifica, não é JSON, ou faltam os campos: c tem de ser um texto e i um inteiro)
export function codificarCursor({ criadaEm, id }) {
  return Buffer.from(JSON.stringify({ c: criadaEm, i: id })).toString('base64url');
}
export function descodificarCursor(texto) {
  try {
    const { c, i } = JSON.parse(Buffer.from(texto, 'base64url').toString('utf8'));
    if (typeof c !== 'string' || !Number.isInteger(i)) throw new Error();
    return { criadaEm: c, id: i };
  } catch {
    throw new ErroCursor('Cursor inválido');
  }
}

// pagina(db, { limite = 20, depois }) → { itens: [{ id, titulo }], proximo }
//   limite: inteiro de 1 a 100 (senão ErroCursor com 'limite' na mensagem)
//   depois: o cursor devolvido pela página anterior (ou nada para a primeira)
//   proximo: o cursor da última linha devolvida, ou null se não houver mais nada
//   Faz UMA consulta com a condição (criada_em, id) < (cursor) e LIMIT limite + 1 (a linha a mais
//   diz se há próxima página, sem um COUNT). O cursor guarda criada_em em texto ISO (toISOString).
export async function pagina(db, { limite = 20, depois } = {}) {
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new ErroCursor('O limite tem de ser um inteiro de 1 a 100');
  const cursor = depois ? descodificarCursor(depois) : null;
  const { rows } = await db.query(
    `SELECT id, titulo, criada_em FROM tarefas
      WHERE $1::timestamptz IS NULL OR (criada_em, id) < ($1::timestamptz, $2::int)
      ORDER BY criada_em DESC, id DESC LIMIT $3`,
    [cursor?.criadaEm ?? null, cursor?.id ?? null, limite + 1],
  );
  const itens = rows.slice(0, limite);
  const ultima = itens.at(-1);
  const proximo = rows.length > limite ? codificarCursor({ criadaEm: new Date(ultima.criada_em).toISOString(), id: ultima.id }) : null;
  return { itens: itens.map(({ id, titulo }) => ({ id, titulo })), proximo };
}
```
</details>

### P3 · Versões (≈25 min)

**Ficheiro:** `versoes.js`

Escolher a versão pelo cabeçalho ou pelo tipo de media, avisar com `Deprecation` e `Sunset`, transformar o modelo interno para a v1, e classificar mudanças em compatíveis ou não.

**Sintaxe que vais praticar:** uma expressão regular com um grupo para o tipo de media, `Object.hasOwn` com uma chave numérica, `switch` com casos agrupados, `toUTCString`.

<details>
<summary>Pista</summary>

Em `partePedidos`, os três tipos que partem sempre podem partilhar o mesmo `return true` num `switch` (casos seguidos sem `break`). Os outros dois dependem de onde está a mudança.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Versões de uma API e mudanças que partem (ou não) os clientes.

// As versões que a API conhece. A v1 está obsoleta (deprecated) e tem data para desligar (sunset).
export const VERSOES = {
  1: { obsoleta: true, desligaEm: '2027-03-31' },
  2: { obsoleta: false },
};
export const ATUAL = 2;

// escolherVersao(cabecalhos) → { versao, cabecalhosResposta }
//   A versão vem do cabeçalho 'api-version' ('1', '2') ou do tipo de media no 'accept'
//   ('application/vnd.tarefas.v1+json'); o 'api-version' tem prioridade. Sem nenhum → ATUAL.
//   Uma versão que não existe em VERSOES → lança um Error com 'Versão' na mensagem.
//   cabecalhosResposta: sempre { 'API-Version': '<n>' }; numa versão obsoleta, também
//   'Deprecation': 'true' e 'Sunset': a data de desligar em formato HTTP (new Date(...).toUTCString()).
export function escolherVersao(cabecalhos) {
  let pedida = cabecalhos['api-version'];
  if (pedida === undefined) {
    const m = /application\/vnd\.tarefas\.v(\d+)\+json/.exec(cabecalhos.accept ?? '');
    if (m) pedida = m[1];
  }
  const versao = pedida === undefined ? ATUAL : Number(pedida);
  if (!Object.hasOwn(VERSOES, versao)) throw new Error(`Versão desconhecida: ${pedida}`);
  const cabecalhosResposta = { 'API-Version': String(versao) };
  if (VERSOES[versao].obsoleta) {
    cabecalhosResposta.Deprecation = 'true';
    cabecalhosResposta.Sunset = new Date(VERSOES[versao].desligaEm).toUTCString();
  }
  return { versao, cabecalhosResposta };
}

// paraVersao(tarefa, versao) → a tarefa no formato dessa versão. O modelo interno (= v2) é
//   { id, titulo, estado: 'aberta' | 'em_curso' | 'feita', etiquetas: [...] }.
//   A v1 tinha { id, title, done: boolean } (sem etiquetas; done é estado === 'feita').
export function paraVersao(tarefa, versao) {
  if (versao === 1) return { id: tarefa.id, title: tarefa.titulo, done: tarefa.estado === 'feita' };
  return { id: tarefa.id, titulo: tarefa.titulo, estado: tarefa.estado, etiquetas: tarefa.etiquetas };
}

// partePedidos(mudanca) → true se a mudança PARTE clientes existentes (exige uma versão nova).
//   mudanca: { tipo, onde: 'pedido' | 'resposta', obrigatorio? }
//   tipos: 'campo-novo', 'campo-removido', 'campo-renomeado', 'tipo-alterado', 'valor-enum-novo'
//   Regras:
//   - remover, renomear ou mudar o tipo de um campo: parte sempre
//   - campo novo na resposta: não parte (os clientes ignoram o que não conhecem)
//   - campo novo no pedido: só parte se for obrigatório
//   - valor novo num enum: na RESPOSTA parte (um cliente com um switch sobre os valores não o
//     conhece); no PEDIDO não parte (é uma opção a mais)
export function partePedidos({ tipo, onde, obrigatorio = false }) {
  switch (tipo) {
    case 'campo-removido':
    case 'campo-renomeado':
    case 'tipo-alterado':
      return true;
    case 'campo-novo':
      return onde === 'pedido' && obrigatorio;
    case 'valor-enum-novo':
      return onde === 'resposta';
    default:
      throw new Error(`Tipo de mudança desconhecido: ${tipo}`);
  }
}
```
</details>

### P4 · If-Match e merge patch (≈35 min)

**Ficheiro:** `concorrencia.js`

O JSON Merge Patch do RFC 7396 (com os casos do próprio RFC nos testes), e um servidor com versões, ETags, `428`, `412`, `415` e `400`, que impede a atualização perdida.

**Sintaxe que vais praticar:** recursão sobre objetos, `delete`, ler o corpo de um pedido com `for await (const pedaco of req)`, `res.writeHead(...).end()`.

<details>
<summary>Pista</summary>

No merge patch, o caso base é "o patch não é um objeto": devolve-o. Senão, copia o alvo (ou começa com `{}`), e para cada chave do patch: `null` apaga, objeto junta recursivamente, outro valor substitui. No servidor, verifica as pré-condições pela ordem dos comentários **antes** de ler o corpo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Atualizações seguras numa API: If-Match (sem atualizações perdidas) e JSON Merge Patch.
import { createServer } from 'node:http';

// aplicarMergePatch(alvo, patch) → um objeto NOVO (RFC 7396):
//   - se o patch não for um objeto (ou for um array), o resultado é o próprio patch
//   - senão, para cada chave do patch: null → apaga a chave; um objeto → merge recursivo com o
//     valor atual (ou {} se não for um objeto); outro valor → substitui
//   O alvo não é alterado.
export function aplicarMergePatch(alvo, patch) {
  const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!ehObjeto(patch)) return patch;
  const r = ehObjeto(alvo) ? { ...alvo } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete r[k];
    else r[k] = ehObjeto(v) ? aplicarMergePatch(r[k], v) : v;
  }
  return r;
}

// criarServidor(tarefas) → um http.Server com uma só rota, /tarefas/:id, sobre um Map id → tarefa.
//   Cada tarefa guardada tem uma versão (começa em 1 e sobe a cada alteração); o ETag é '"<versão>"'.
//   GET     → 200 com a tarefa (JSON) e o ETag; 404 se não existir
//   PATCH   → corpo em application/merge-patch+json; aplica com aplicarMergePatch
//             - sem If-Match → 428 (Precondition Required): obriga o cliente a dizer que versão viu
//             - If-Match diferente do ETag atual → 412 (Precondition Failed): alguém mudou entretanto
//             - Content-Type diferente de application/merge-patch+json → 415
//             - corpo que não é JSON → 400
//             - senão → 200 com a tarefa nova e o ETag novo
//   Rota ou método desconhecido → 404 / 405. (Os erros podem ir sem corpo.)
export function criarServidor(tarefas) {
  const versoes = new Map([...tarefas.keys()].map((id) => [id, 1]));
  return createServer(async (req, res) => {
    const m = /^\/tarefas\/(\d+)$/.exec(req.url);
    if (!m) return res.writeHead(404).end();
    const id = Number(m[1]);
    if (!tarefas.has(id)) return res.writeHead(404).end();
    const etag = () => `"${versoes.get(id)}"`;
    const enviar = (estado) => {
      res.writeHead(estado, { 'Content-Type': 'application/json', ETag: etag() });
      res.end(JSON.stringify(tarefas.get(id)));
    };
    if (req.method === 'GET') return enviar(200);
    if (req.method !== 'PATCH') return res.writeHead(405).end();
    if (!req.headers['if-match']) return res.writeHead(428).end();
    if (req.headers['if-match'] !== etag()) return res.writeHead(412).end();
    if (req.headers['content-type'] !== 'application/merge-patch+json') return res.writeHead(415).end();
    let corpo = '';
    for await (const pedaco of req) corpo += pedaco;
    let patch;
    try {
      patch = JSON.parse(corpo);
    } catch {
      return res.writeHead(400).end();
    }
    tarefas.set(id, aplicarMergePatch(tarefas.get(id), patch));
    versoes.set(id, versoes.get(id) + 1);
    enviar(200);
  });
}
```
</details>

## Experiências

1. **Os erros da API do workshop:** provoca um erro de validação, um 404 e um 401 com `curl -i`. Que formato tem cada um? Converte o *middleware* de erros da API para Problem Details.
2. **OFFSET vs. cursor:** com 1 milhão de tarefas no Postgres do workshop, compara o `EXPLAIN ANALYZE` de `ORDER BY created_at DESC LIMIT 20 OFFSET 500000` com a versão por cursor. E repara no que acontece à página 2 se criares uma tarefa entre os dois pedidos.
3. **Uma quebra no OpenAPI:** muda um campo no `openapi.yaml` e corre uma ferramenta de comparação de contratos (por exemplo, `npx @useoptic/optic diff` ou o `oasdiff` em Docker) para ver se a mudança é classificada como *breaking*.
4. **Atualização perdida no browser:** abre a mesma tarefa em dois separadores e edita nos dois. A API do workshop deteta o conflito? O que seria preciso mudar no frontend e na API?

## Perguntas de pensamento crítico

1. Uma API devolve o estado da tarefa como um enum (`aberta`, `feita`). A equipa quer acrescentar `bloqueada`. É uma mudança compatível?
2. Porque é que a paginação por cursor não permite "saltar para a página 50", e quando é que isso é um problema?
3. Porque é que a API deve exigir o `If-Match` (428) em vez de o aceitar só quando vem?

<details>
<summary>Respostas</summary>

1. Para os clientes que **leem** o estado, não necessariamente: um cliente com um `switch` sem caso por omissão, ou com uma validação estrita do enum, parte quando recebe um valor que não conhece (um ecrã em branco, uma exceção). Por isso, ou se trata como *breaking* (versão nova, ou só devolver `bloqueada` a clientes que digam que a suportam), ou se documenta desde o início que o enum pode crescer e que os clientes têm de tolerar valores desconhecidos, e se confirma isso nos testes de contrato.
2. Porque cada página só sabe onde acaba a anterior: para chegar à 50 é preciso percorrer as 49 antes (não há "posição 1000" sem ler as anteriores, que é exatamente o que o `OFFSET` faz devagar). É um problema em interfaces com números de página clicáveis (tabelas de administração, resultados de pesquisa); é irrelevante em *scroll* infinito, em APIs para sincronizar dados e em exportações, que são a maioria dos casos. Para as tabelas, um compromisso é o `OFFSET` com um limite máximo de páginas, ou filtros em vez de páginas fundas.
3. Porque, se for opcional, os clientes que se esquecem dele (ou os mais antigos) continuam a provocar atualizações perdidas em silêncio, e o problema só aparece quando um utilizador se queixa de que a sua alteração desapareceu. Exigindo-o, a API obriga todos os clientes a declarar que versão viram, e o conflito passa a ser visível (um `412` tratado) em vez de perda de dados silenciosa.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 44`.

**1.** Que formato padrão o RFC 9457 define para os erros de uma API HTTP?

- a) application/error+xml
- b) Problem Details: application/problem+json com type, title, status, detail, instance
- c) Um campo error com texto livre
- d) Os códigos HTTP chegam, sem corpo

<details><summary>Resposta</summary>

**b) Problem Details: application/problem+json com type, title, status, detail, instance** — Podem acrescentar-se extensões, como uma lista de erros de validação.

</details>

**2.** Qual é a vantagem principal da paginação por cursor sobre o OFFSET?

- a) Permite saltar para qualquer página
- b) É rápida em qualquer página e estável quando entram linhas novas
- c) Não precisa de ORDER BY
- d) Funciona sem índices

<details><summary>Resposta</summary>

**b) É rápida em qualquer página e estável quando entram linhas novas** — O OFFSET lê e deita fora as linhas anteriores, e desloca-se com inserções.

</details>

**3.** Qual destas mudanças NÃO parte os clientes existentes?

- a) Remover um campo da resposta
- b) Um campo novo na resposta
- c) Mudar o tipo de um campo
- d) Um campo novo obrigatório no pedido

<details><summary>Resposta</summary>

**b) Um campo novo na resposta** — Os clientes devem ignorar campos que não conhecem.

</details>

**4.** Que código HTTP responde um servidor quando o If-Match não corresponde ao ETag atual?

<details><summary>Resposta</summary>

**412** — Evita a atualização perdida; o 428 exige que o If-Match venha.

</details>

**5.** Num JSON Merge Patch, o que faz { "prazo": null }?

- a) Põe o prazo a null
- b) Apaga o campo prazo
- c) Ignora o campo
- d) Dá erro

<details><summary>Resposta</summary>

**b) Apaga o campo prazo** — Por isso o merge patch não consegue pôr um campo a null; para isso há o JSON Patch.

</details>

<!-- quiz:end -->
