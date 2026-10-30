# 57 · Next.js e renderização no servidor

**Objetivo:** perceber as formas de renderizar uma aplicação React (no cliente, no servidor, estática, incremental) e o que cada uma custa, e como o Next.js as junta: rotas a partir de ficheiros, componentes de servidor e de cliente, *server actions* e cache. Construindo as peças centrais à mão, para o Next.js deixar de ser magia.

**Ficheiros para ler:** `src/web/src/main.jsx` e `src/web/src/App.jsx` (o frontend do workshop, renderizado só no cliente) e `src/web/index.html` (o HTML quase vazio que o servidor envia).

**Pré-requisitos:** módulos 08 (React), 26 (XSS), 43 (cache HTTP) e 56 (Core Web Vitals).

---

## 1. O problema da página em branco

O frontend do workshop é uma **SPA** renderizada no cliente (*CSR*, *client-side rendering*): o servidor envia um HTML com um `<div id="root"></div>` vazio e um *bundle* de JavaScript; o browser descarrega o JS, executa-o, o React pede os dados à API, e só então aparece alguma coisa. Funciona bem numa aplicação interna atrás de um login, mas tem custos:

- **Primeira pintura lenta**, sobretudo em telemóveis: HTML → JS → executar → pedir dados → pintar. O LCP (módulo 56) sofre.
- **Motores de pesquisa e pré-visualizações** (quando se partilha um link) veem uma página vazia, ou têm de executar o JS.
- **Tudo vai para o browser**: cada biblioteca usada para formatar uma data ou ler Markdown aumenta o *bundle*.

## 2. As formas de renderizar

| Estratégia | Quando se gera o HTML | Bom para | Custo |
|---|---|---|---|
| **CSR** | no browser, depois de carregar o JS | painéis atrás de login, muito interativos | primeira pintura lenta, SEO fraco |
| **SSR** (*server-side rendering*) | no servidor, a cada pedido | páginas com dados por utilizador ou sempre frescos | um servidor a correr; cada pedido gasta CPU e espera pelos dados |
| **SSG** (*static site generation*) | uma vez, no *build* | documentação, blogues, páginas de marketing | os dados ficam fixos até ao próximo *build* |
| **ISR** (*incremental static regeneration*) | como o SSG, mas regenerada em segundo plano quando fica velha | catálogos, artigos, páginas públicas que mudam às vezes | pode servir uma versão com alguns segundos/minutos |

No SSR e no SSG, o browser recebe HTML já com o conteúdo, e depois o React **hidrata** a página: carrega o mesmo componente no cliente, liga os *event listeners* ao HTML que já lá está, e a partir daí funciona como uma SPA. Para isso, o cliente precisa **dos mesmos dados** que o servidor usou, que vão embutidos no HTML. Se o HTML gerado no cliente não bater com o do servidor (uma data com o fuso horário do servidor, um `Math.random()`), há um **erro de hidratação**.

E há um cuidado de segurança: os dados embutidos num `<script>` no HTML são texto controlado pelo utilizador (o título de uma tarefa). Um título `</script><script>alert(1)</script>` fecha o script e o resto é executado: é o XSS do módulo 26. O `JSON.stringify` sozinho não protege; é preciso escapar o `<`.

## 3. O Next.js

O Next.js (da Vercel) é a *framework* de React mais usada, e junta todas estas estratégias numa só aplicação, página a página. Com o **App Router** (desde a versão 13):

- **Rotas a partir de pastas**: `app/tarefas/[id]/page.js` serve `/tarefas/42`, com `params.id === '42'`. Há segmentos dinâmicos (`[id]`), apanha-tudo (`[...partes]`), apanha-tudo opcionais (`[[...partes]]`) e grupos que não aparecem no URL (`(marketing)`). Cada pasta pode ter ainda um `layout.js` (partilhado pelas páginas de dentro), `loading.js` (o que se mostra enquanto os dados chegam) e `error.js`.
- **Componentes de servidor** (*React Server Components*), por omissão: correm **só** no servidor, podem ser `async` e ler a base de dados diretamente, e o seu código **nunca vai para o browser** (só o resultado). A biblioteca de Markdown de 200 KB que usas para renderizar um artigo fica no servidor.
- **Componentes de cliente**: um ficheiro que começa com `'use client'` é enviado para o browser e hidratado; pode usar estado (`useState`), efeitos e eventos. **Tudo o que ele importa** passa a ser de cliente também. A arte está em empurrar o `'use client'` para as folhas da árvore (o botão, o formulário), e manter o resto no servidor.
- **Server actions**: funções com `'use server'` que o cliente chama como se fossem locais (por exemplo, no `action` de um formulário), e que correm no servidor. Por baixo, são um `POST`. São uma API pública: validam a entrada e verificam permissões como qualquer rota (módulo 13).
- **Streaming**: o servidor envia o HTML aos bocados, com `<Suspense>`: o esqueleto da página chega logo, e as partes lentas chegam quando os dados estiverem prontos.

## 4. A fronteira entre servidor e cliente

A separação é poderosa, mas é preciso cuidado com o que atravessa a fronteira:

- **Segredos**: no Next.js, só as variáveis de ambiente com o prefixo `NEXT_PUBLIC_` são incluídas no código do cliente. Uma `process.env.STRIPE_SECRET_KEY` num componente de cliente é `undefined` no browser (o que parte a funcionalidade) ou, com outras ferramentas de *build*, fica escrita no JavaScript público.
- **Código só do servidor**: o pacote `server-only`, importado num módulo, faz o *build* falhar se esse módulo for parar ao cliente. Usa-o em tudo o que fala com a base de dados.
- **Props serializáveis**: um componente de servidor passa props a um de cliente pela rede, por isso só passam dados (texto, números, objetos simples), não funções nem instâncias de classes (salvo *server actions*).
- **Componentes `async`** só existem no servidor.

## 5. Cache e revalidação

Num SSR ingénuo, cada pedido gera a página de novo, e cada geração vai à base de dados. O Next.js tem várias camadas de cache, e a mais importante de perceber é a da página inteira, a **ISR**: a página é gerada uma vez e servida da cache; quando passa o tempo de `revalidate`, o próximo pedido ainda recebe a versão velha (rápido), e a geração de uma versão nova começa em segundo plano. É o `stale-while-revalidate` do módulo 43, aplicado no servidor. E quando os dados mudam (um *server action* que cria uma tarefa), chama-se `revalidatePath('/tarefas')` para a próxima visita gerar a página de novo.

As versões recentes do Next.js mudaram várias vezes os valores por omissão da cache (mais cache na 13 e 14, menos na 15, com a diretiva `'use cache'` para optar). Por isso, a regra prática é: lê a documentação da versão que estás a usar e **verifica** os cabeçalhos e os tempos de resposta, em vez de assumir.

## 6. Onde correr, e quando não usar

Uma aplicação Next.js precisa de um servidor Node (ou de uma plataforma como a Vercel, a Netlify, ou um contentor no Kubernetes do módulo 32), exceto se for toda estática (`output: 'export'`). Há alternativas com outras filosofias: o **Remix**/React Router (mais perto dos padrões da web: formulários, `fetch`), o **Astro** (sites de conteúdo, quase sem JavaScript, "ilhas" interativas), o **Nuxt** (o equivalente para Vue) e o **SvelteKit**.

Para um painel interno atrás de um login, como o frontend do workshop, uma SPA com o Vite continua a ser uma escolha perfeitamente boa: não há SEO, os utilizadores usam a aplicação durante horas (o custo do primeiro carregamento dilui-se), e não há um servidor de renderização para operar.

## Em resumo

- Há quatro formas de renderizar: no cliente (**CSR**), no servidor a cada pedido (**SSR**), no build (**SSG**) e regenerada em segundo plano (**ISR**); cada uma troca frescura, desempenho e custo.
- No SSR, o React **hidrata** o HTML do servidor com os mesmos dados, embutidos no HTML **sem permitir XSS** (escapar o `<`).
- No App Router do Next.js, as rotas vêm das **pastas** (segmentos dinâmicos, apanha-tudo, grupos).
- Os **componentes de servidor** (por omissão) leem dados diretamente e não vão para o browser; um `'use client'` torna o ficheiro e tudo o que ele importa de cliente.
- Só as variáveis `NEXT_PUBLIC_` chegam ao cliente, e o pacote `server-only` impede código de servidor de lá ir parar.
- A ISR serve a versão em cache e regenera em segundo plano; `revalidatePath` força a regeneração depois de uma escrita.
- Para um painel atrás de login, uma SPA continua a ser uma escolha perfeitamente boa.

---

## Prática: escreve tu

As peças centrais de uma *framework* como o Next.js, à mão: um router a partir de ficheiros (com dinâmicos, apanha-tudo e grupos), a renderização no servidor com o React e os dados embutidos sem XSS, uma cache de páginas com regeneração incremental, e um verificador das fronteiras entre componentes de servidor e de cliente.

**Ficheiros:** `pratica/57-nextjs-e-ssr/` (`rotas.js`, `ssr.js`, `isr.js`, `fronteiras.js`)

**Verificar:** `npm run verificar 57` (dentro de `pratica/`). Só um exercício: `npm run verificar 57 rotas`, `... 57 ssr`, `... 57 isr` ou `... 57 fronteiras`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Rotas a partir de ficheiros (≈35 min)

**Ficheiro:** `rotas.js`

Transformar caminhos como `app/tarefas/[id]/page.js` em rotas, encontrar a rota de um URL com os `params`, e escolher a mais específica quando várias servem.

**Sintaxe que vais praticar:** expressões regulares com grupos (`/^\[\.\.\.(\w+)\]$/`), atribuição dentro de um `if` (`if ((m = re.exec(s)))`), `decodeURIComponent`, uma função de comparação para `sort` que compara listas posição a posição.

<details>
<summary>Pista</summary>

Divide em três funções: ficheiro → lista de segmentos (sem os grupos); segmentos + partes do URL → params ou `null`; e a ordenação das rotas que servem. Para a especificidade, dá um peso a cada tipo de segmento (estático 0, dinâmico 1, ...) e compara as duas rotas posição a posição: a primeira posição diferente decide.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Rotas a partir de ficheiros, como no App Router do Next.js.

// criarRouter(ficheiros) → { resolver(caminho) → { ficheiro, params } | null }
//   ficheiros: caminhos como 'app/tarefas/[id]/page.js'. Só contam os que acabam em '/page.js';
//   'app/page.js' é a rota '/'.
//   Segmentos da pasta:
//     'tarefas'       → estático: tem de ser igual
//     '[id]'          → dinâmico: apanha UM segmento → params.id (texto, com decodeURIComponent)
//     '[...partes]'   → apanha tudo: UM ou mais segmentos → params.partes (lista)
//     '[[...partes]]' → apanha tudo, opcional: ZERO ou mais → params.partes (lista, possivelmente vazia)
//     '(marketing)'   → grupo: organiza as pastas mas NÃO aparece no URL
//   Quando várias rotas servem, ganha a mais específica, segmento a segmento, da esquerda para
//   a direita: estático > dinâmico > apanha-tudo > apanha-tudo opcional.
//   O caminho pode ter ou não '/' no fim ('/tarefas/' = '/tarefas').
const PESO = { estatico: 0, dinamico: 1, tudo: 2, opcional: 3 };

function segmentosDe(ficheiro) {
  return ficheiro
    .replace(/^app\//, '')
    .replace(/(^|\/)page\.js$/, '')
    .split('/')
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((s) => {
      let m;
      if ((m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s))) return { tipo: 'opcional', nome: m[1] };
      if ((m = /^\[\.\.\.(\w+)\]$/.exec(s))) return { tipo: 'tudo', nome: m[1] };
      if ((m = /^\[(\w+)\]$/.exec(s))) return { tipo: 'dinamico', nome: m[1] };
      return { tipo: 'estatico', valor: s };
    });
}

function corresponder(segs, partes) {
  const params = {};
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.tipo === 'tudo' || s.tipo === 'opcional') {
      const resto = partes.slice(i);
      if (s.tipo === 'tudo' && resto.length === 0) return null;
      params[s.nome] = resto.map(decodeURIComponent);
      return params;
    }
    if (i >= partes.length) return null;
    if (s.tipo === 'estatico' && s.valor !== partes[i]) return null;
    if (s.tipo === 'dinamico') params[s.nome] = decodeURIComponent(partes[i]);
  }
  return segs.length === partes.length ? params : null;
}

export function criarRouter(ficheiros) {
  const rotas = ficheiros.filter((f) => /(^|\/)page\.js$/.test(f)).map((ficheiro) => ({ ficheiro, segs: segmentosDe(ficheiro) }));
  const compararEspecificidade = (a, b) => {
    for (let i = 0; i < Math.max(a.segs.length, b.segs.length); i++) {
      const pa = a.segs[i] ? PESO[a.segs[i].tipo] : -1;
      const pb = b.segs[i] ? PESO[b.segs[i].tipo] : -1;
      if (pa !== pb) return pa - pb;
    }
    return 0;
  };
  return {
    resolver(caminho) {
      const partes = caminho.split('/').filter(Boolean);
      const candidatas = rotas
        .map((r) => ({ ...r, params: corresponder(r.segs, partes) }))
        .filter((r) => r.params !== null)
        .sort(compararEspecificidade);
      return candidatas.length ? { ficheiro: candidatas[0].ficheiro, params: candidatas[0].params } : null;
    },
  };
}
```
</details>

### P2 · Renderizar no servidor (≈20 min)

**Ficheiro:** `ssr.js`

Escapar HTML, serializar os dados para dentro de um `<script>` sem permitir que o fechem, e montar o documento completo com o `renderToString` do React.

**Sintaxe que vais praticar:** `renderToString` e `createElement` (o JSX sem compilador), `replace` com uma função e uma tabela, `charCodeAt(0).toString(16).padStart(4, '0')`.

<details>
<summary>Pista</summary>

Em JSON, dentro de um texto, `<` é exatamente o mesmo que `<`: o `JSON.parse` devolve os mesmos dados, mas o HTML deixa de ver um `</script>`. Por isso basta trocar cada carácter perigoso pela sua sequência `\uXXXX` depois do `JSON.stringify`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Renderizar no servidor (SSR) e passar os dados ao cliente sem abrir uma porta a XSS.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// escaparHtml(texto) → o texto com & < > " ' trocados pelas entidades (&amp; &lt; &gt; &quot; &#39;)
export function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// serializarDados(dados) → JSON seguro para pôr dentro de um <script> no HTML.
//   JSON.stringify sozinho NÃO chega: um texto com '</script>' fecharia o script e o resto seria
//   HTML (XSS). Troca '<' por '<', '>' por '>', '&' por '&', e os separadores
//   de linha U+2028 e U+2029 pelas suas sequências \u2028 e \u2029. O resultado continua a ser
//   JSON válido que dá os mesmos dados com JSON.parse.
export function serializarDados(dados) {
  return JSON.stringify(dados).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

// renderizarDocumento({ componente, props, titulo }) → o HTML completo da página:
//   <!doctype html><html lang="pt"><head><meta charset="utf-8"><title>TITULO</title></head>
//   <body><div id="raiz">HTML_DO_COMPONENTE</div>
//   <script id="__DADOS__" type="application/json">DADOS</script>
//   <script type="module" src="/cliente.js"></script></body></html>
//   (tudo seguido, sem quebras de linha nem espaços entre as etiquetas)
//   TITULO escapado com escaparHtml; HTML_DO_COMPONENTE = renderToString(createElement(componente, props));
//   DADOS = serializarDados(props), para o cliente "hidratar" com os mesmos props.
export function renderizarDocumento({ componente, props, titulo }) {
  return (
    `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title></head>` +
    `<body><div id="raiz">${renderToString(createElement(componente, props))}</div>` +
    `<script id="__DADOS__" type="application/json">${serializarDados(props)}</script>` +
    `<script type="module" src="/cliente.js"></script></body></html>`
  );
}
```
</details>

### P3 · Regeneração incremental (≈30 min)

**Ficheiro:** `isr.js`

Uma cache de páginas com MISS, HIT e STALE, uma só geração de cada vez por caminho (mesmo com pedidos em paralelo), regeneração em segundo plano que sobrevive a falhas, e invalidação.

**Sintaxe que vais praticar:** um `Map` de promessas em curso, `.finally` para limpar, uma promessa "solta" com `.catch(() => {})` para não haver *unhandled rejections*.

<details>
<summary>Pista</summary>

Escreve uma função `gerarUmaVez(caminho)` que reaproveita a promessa em curso, se houver, e que, quando a geração acaba bem, guarda o HTML com o instante. O MISS espera por ela; o STALE chama-a e não espera.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Regeneração estática incremental (ISR): páginas geradas uma vez e servidas da cache,
// regeneradas em segundo plano quando ficam velhas (o stale-while-revalidate do módulo 43, no servidor).

// criarCachePaginas({ gerar, revalidar, agora = Date.now }) → { obter(caminho), invalidar(caminho) }
//   gerar: async (caminho) → html     revalidar: segundos     agora: relógio em milissegundos
//   obter(caminho) → Promise de { html, estado }:
//   - não há nada em cache → gera, guarda, 'MISS' (pedidos em paralelo para o mesmo caminho
//     esperam pela MESMA geração)
//   - em cache há menos de `revalidar` segundos → 'HIT'
//   - em cache há mais → devolve LOGO o html velho com 'STALE', e começa a regenerar em segundo
//     plano (uma só regeneração de cada vez por caminho). Quando acabar, a cache fica com o novo
//     (a contar de quando acabou). Se a regeneração falhar, fica o velho, e tenta-se no pedido seguinte.
//   invalidar(caminho): apaga o caminho da cache (o próximo pedido é um MISS); é o
//     revalidatePath do Next.js, chamado depois de uma escrita.
export function criarCachePaginas({ gerar, revalidar, agora = Date.now }) {
  const entradas = new Map(); // caminho → { html, geradoEm }
  const aGerar = new Map(); // caminho → Promise
  function gerarUmaVez(caminho) {
    if (!aGerar.has(caminho)) {
      const p = Promise.resolve()
        .then(() => gerar(caminho))
        .then((html) => {
          entradas.set(caminho, { html, geradoEm: agora() });
          return html;
        })
        .finally(() => aGerar.delete(caminho));
      aGerar.set(caminho, p);
    }
    return aGerar.get(caminho);
  }
  return {
    async obter(caminho) {
      const e = entradas.get(caminho);
      if (!e) return { html: await gerarUmaVez(caminho), estado: 'MISS' };
      if ((agora() - e.geradoEm) / 1000 < revalidar) return { html: e.html, estado: 'HIT' };
      gerarUmaVez(caminho).catch(() => {});
      return { html: e.html, estado: 'STALE' };
    },
    invalidar(caminho) {
      entradas.delete(caminho);
    },
  };
}
```
</details>

### P4 · A fronteira servidor/cliente (≈25 min)

**Ficheiro:** `fronteiras.js`

Descobrir que módulos acabam no cliente (a diretiva `'use client'` e tudo o que ela importa, em vários níveis e com ciclos) e apontar os segredos, os pacotes só de servidor e os componentes `async` que lá foram parar.

**Sintaxe que vais praticar:** uma pesquisa em profundidade com um `Set` de visitados, uma expressão regular com uma referência a um grupo (`(['"])use client\1`), `matchAll`.

<details>
<summary>Pista</summary>

Primeiro marca os módulos de cliente: para cada módulo com a diretiva, visita-o e visita recursivamente o que ele importa (se estiver em `modulos` e ainda não tiver sido visitado: é isso que evita os ciclos). Só depois verifica as regras nos módulos marcados.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Componentes de servidor e de cliente: o que pode ir para o browser?
// No App Router do Next.js, os componentes são de SERVIDOR por omissão (correm só no servidor,
// podem ler a base de dados, e o seu código nunca chega ao browser). Um ficheiro que comece com
// a diretiva 'use client' é de CLIENTE, e TUDO o que ele importa passa também a ser de cliente
// (vai no JavaScript enviado ao browser).

// verificarFronteiras(modulos) → lista de problemas (texto), ordenada
//   modulos: { [caminho]: { codigo, importa: [caminhos de outros módulos ou pacotes] } }
//   1. Um módulo é de cliente se o código começar pela diretiva 'use client' (ou "use client",
//      com ou sem ';', depois de espaços ou linhas em branco), ou se for importado, direta ou
//      indiretamente, por um módulo de cliente. (Imports de pacotes que não estão em `modulos`
//      não se seguem.)
//   2. Para cada módulo de cliente:
//      - cada process.env.NOME com NOME que não comece por NEXT_PUBLIC_ →
//          '<caminho>: process.env.<NOME> no cliente' (o segredo ia parar ao browser)
//      - importar 'server-only', 'pg', 'fs' ou 'node:fs' → '<caminho>: importa <pacote> no cliente'
//      - export default async function → '<caminho>: componente async no cliente'
export const SO_SERVIDOR = ['server-only', 'pg', 'fs', 'node:fs'];

export function verificarFronteiras(modulos) {
  const ehDiretiva = (codigo) => /^\s*(['"])use client\1;?/.test(codigo);
  const cliente = new Set();
  const visitar = (caminho) => {
    if (cliente.has(caminho) || !modulos[caminho]) return;
    cliente.add(caminho);
    for (const i of modulos[caminho].importa) visitar(i);
  };
  for (const [caminho, m] of Object.entries(modulos)) if (ehDiretiva(m.codigo)) visitar(caminho);

  const problemas = [];
  for (const caminho of cliente) {
    const { codigo, importa } = modulos[caminho];
    for (const [, nome] of codigo.matchAll(/process\.env\.(\w+)/g)) {
      if (!nome.startsWith('NEXT_PUBLIC_')) problemas.push(`${caminho}: process.env.${nome} no cliente`);
    }
    for (const i of importa) if (SO_SERVIDOR.includes(i)) problemas.push(`${caminho}: importa ${i} no cliente`);
    if (/export\s+default\s+async\s+function/.test(codigo)) problemas.push(`${caminho}: componente async no cliente`);
  }
  return problemas.sort();
}
```
</details>

## Experiências

1. **Um Next.js a sério:** `npx create-next-app@latest tarefas-next` (numa pasta fora do workshop), cria `app/tarefas/[id]/page.js` e vê as rotas. Depois faz `npm run build` e lê a tabela que o *build* imprime: que páginas são estáticas (○), dinâmicas (ƒ) ou ISR?
2. **Ver o HTML:** compara `curl http://localhost:8080` (o frontend do workshop) com o Next.js em modo de desenvolvimento (`npm run dev`, na porta 3000) e `curl http://localhost:3000/tarefas/1`. O que vem no HTML em cada um?
3. **O XSS do P2:** escreve um pequeno servidor com o teu `renderizarDocumento` e uma tarefa com o título `</script><script>alert(1)</script>`. Troca o `serializarDados` por um `JSON.stringify` simples e abre a página no browser.
4. **Server actions:** no projeto Next.js, cria um formulário que acrescenta uma tarefa com uma *server action* e `revalidatePath`. Olha para o separador *Network*: que pedido é feito?

## Perguntas de pensamento crítico

1. A equipa quer migrar o frontend do workshop (um painel atrás de login) para o Next.js "por causa do SEO e do desempenho". Concordas?
2. Porque é que pôr `'use client'` no topo do `layout.js` da raiz é um problema, mesmo que tudo continue a funcionar?
3. Uma página de produto com ISR e `revalidate: 600` mostra um preço desatualizado durante 10 minutos depois de uma alteração. Como resolves sem desligar a cache?

<details>
<summary>Respostas</summary>

1. Provavelmente não, pelo menos por essas razões: atrás de um login não há SEO, e os utilizadores usam o painel durante muito tempo, por isso o custo do primeiro carregamento dilui-se (e pode ser melhorado com *code splitting* e cache). A migração traz custos reais: um servidor Node para operar e escalar, um modelo mental novo (servidor/cliente, cache), e reescrever a autenticação e a obtenção de dados. Faria sentido se houvesse páginas públicas (marketing, documentação, partilha de tarefas por link) ou medições a mostrar um problema de desempenho que o SSR resolve.
2. Porque tudo o que o layout importa (e, por arrastamento, toda a aplicação) passa a ser de cliente: perde-se o benefício dos componentes de servidor. Todo o código vai para o browser (o *bundle* cresce), não se pode ler dados diretamente nos componentes (é preciso uma API e `useEffect`s), e aumenta o risco de levar para o cliente código ou segredos que eram do servidor. O `'use client'` deve ficar nas folhas: o botão, o formulário, o componente com estado.
3. Revalidação a pedido: quando o preço é alterado (na *server action* ou na API do *back-office*, ou num webhook do sistema de produtos), chama-se `revalidatePath('/produtos/123')` (ou `revalidateTag('produto:123')`, as etiquetas do módulo 43). A página continua em cache entre alterações, mas a seguir a cada alteração o próximo pedido gera-a de novo. O `revalidate: 600` fica como rede de segurança para alterações que escapem.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 57`.

**1.** O que é a hidratação, no SSR com React?

- a) Gerar o HTML no servidor
- b) O React no cliente liga os event listeners ao HTML que veio do servidor, usando os mesmos dados
- c) Comprimir o HTML
- d) Guardar a página em cache

<details><summary>Resposta</summary>

**b) O React no cliente liga os event listeners ao HTML que veio do servidor, usando os mesmos dados** — Se o HTML do cliente não bater com o do servidor, há um erro de hidratação.

</details>

**2.** No App Router do Next.js, que ficheiro serve o URL /tarefas/42?

- a) app/tarefas/42.js
- b) app/tarefas/[id]/page.js
- c) pages/tarefas.js
- d) app/[tarefas]/[42]/page.js

<details><summary>Resposta</summary>

**b) app/tarefas/[id]/page.js** — Pastas são segmentos; [id] é dinâmico e chega em params.id.

</details>

**3.** Que diretiva, no início de um ficheiro, marca um componente de cliente no Next.js?

<details><summary>Resposta</summary>

**use client** — Tudo o que esse ficheiro importa passa também a ser de cliente.

</details>

**4.** Porque é que JSON.stringify(dados) não chega para embutir dados num <script> no HTML?

- a) Porque o JSON não suporta acentos
- b) Porque um texto com </script> fecha o script e o resto é executado como HTML (XSS)
- c) Porque é lento
- d) Porque o browser não lê JSON

<details><summary>Resposta</summary>

**b) Porque um texto com </script> fecha o script e o resto é executado como HTML (XSS)** — Escapa-se o < como \u003c (o mesmo valor em JSON).

</details>

**5.** O que faz uma página com ISR quando o tempo de revalidate passou?

- a) Fica em branco até ser gerada
- b) Serve logo a versão velha e regenera em segundo plano
- c) Devolve um erro 503
- d) Gera a página a cada pedido daí em diante

<details><summary>Resposta</summary>

**b) Serve logo a versão velha e regenera em segundo plano** — É o stale-while-revalidate, no servidor; revalidatePath força a regeneração a pedido.

</details>

<!-- quiz:end -->
