# 43 · Cache HTTP e CDN

**Objetivo:** usar a cache que o próprio HTTP já traz: os cabeçalhos `Cache-Control`, `ETag` e `Vary`, os pedidos condicionais e o `304 Not Modified`, a diferença entre a cache do browser e uma cache partilhada (uma CDN), e como se invalida o que ficou em cache, que é a parte difícil.

**Ficheiros para ler:** `src/web/vite.config.js` (o build gera nomes com hash), `src/web/nginx.conf` (o Nginx que serve o frontend) e as rotas da API em `src/api/src/routes/`.

**Pré-requisitos:** módulos 01 (HTTP), 05 (cache com Redis), 25 (redes) e 37 (system design).

---

## 1. Três níveis de cache

No módulo 05, a API guardou resultados no Redis para não repetir consultas à base de dados. Isso é uma cache **do lado do servidor**: o pedido continua a atravessar a internet e a chegar à API. O HTTP permite cachear mais perto do utilizador:

```
browser (cache privada) ──▶ CDN / proxy (cache partilhada) ──▶ origem (Nginx, API) ──▶ Redis ──▶ Postgres
```

- A **cache do browser** guarda as respostas para **um** utilizador. Um *hit* aqui não gasta rede nenhuma.
- Uma **cache partilhada** (uma CDN como a Cloudflare, o CloudFront ou a Fastly, ou um proxy como o Varnish ou o próprio Nginx) guarda respostas para **todos** os utilizadores, em servidores espalhados pelo mundo, perto deles. Um *hit* aqui poupa a viagem até à origem (dezenas a centenas de milissegundos, módulo 25) e a carga na origem.

Quem decide o que cada uma pode guardar, e por quanto tempo, é a **origem**, com cabeçalhos na resposta.

## 2. O `Cache-Control`

As diretivas que importam:

| Diretiva | Significa |
|---|---|
| `max-age=N` | fresca durante N segundos; até lá, usa-se sem perguntar nada à origem |
| `s-maxage=N` | o mesmo, mas só para caches partilhadas (sobrepõe-se ao `max-age` nelas) |
| `public` | qualquer cache pode guardar, mesmo respostas a pedidos autenticados |
| `private` | só a cache do browser do utilizador; nunca uma CDN |
| `no-cache` | **pode** guardar, mas tem de **revalidar** com a origem antes de cada uso |
| `no-store` | não guardar, em lado nenhum |
| `immutable` | não vai mudar enquanto estiver fresca: o browser nem revalida ao recarregar a página |
| `stale-while-revalidate=N` | depois de expirar, durante N segundos ainda se serve a cópia antiga enquanto se busca a nova em segundo plano |
| `stale-if-error=N` | se a origem falhar, durante N segundos ainda se serve a cópia antiga |

O nome mais traiçoeiro é `no-cache`: não quer dizer "não guardes", quer dizer "não uses sem confirmar". Para não guardar de todo é `no-store`. O cabeçalho antigo `Expires` (uma data) ainda funciona, mas o `max-age` sobrepõe-se a ele.

Sem nenhum destes cabeçalhos, os browsers aplicam **heurísticas** (por exemplo, 10% do tempo desde o `Last-Modified`), o que dá comportamentos difíceis de prever. Por isso: define sempre o `Cache-Control`.

## 3. Uma política para cada tipo de recurso

| Recurso | `Cache-Control` | Porquê |
|---|---|---|
| JS/CSS/imagens com hash no nome (`app.3f2a9c1b.js`) | `public, max-age=31536000, immutable` | o nome muda quando o conteúdo muda, por isso pode ficar em cache um ano |
| O HTML (`index.html`) | `no-cache` | tem de estar sempre atualizado, porque é ele que aponta para os ficheiros com hash |
| Uma API pública (o catálogo) | `public, max-age=60, s-maxage=300, stale-while-revalidate=30` | um pouco desatualizado não faz mal, e a CDN absorve a carga |
| Uma API com dados do utilizador | `private, no-cache` | nunca numa CDN; no browser, sempre revalidado |
| Dados sensíveis (extratos, tokens) | `no-store` | não podem ficar no disco de um computador partilhado |

A combinação das duas primeiras linhas é o padrão do **cache busting** que o Vite já faz no build do frontend: o HTML é pequeno e sempre fresco, e todos os ficheiros pesados ficam em cache "para sempre", porque uma versão nova tem um nome novo.

## 4. Revalidar: ETag e o `304`

Quando uma cópia expira (ou é `no-cache`), a cache não precisa de descarregar tudo outra vez. Pode **perguntar** se mudou, com um **pedido condicional**:

```
GET /api/catalogo                        HTTP/1.1 200 OK
                                         ETag: "a1b2c3"
                                         Cache-Control: no-cache
                                         (corpo de 200 KB)

GET /api/catalogo                        HTTP/1.1 304 Not Modified
If-None-Match: "a1b2c3"                  ETag: "a1b2c3"
                                         (sem corpo)
```

O **ETag** é um identificador da versão do recurso (normalmente um hash do conteúdo). Se não mudou, a origem responde `304` sem corpo, e a cache usa a cópia que tem. Poupa largura de banda e, muitas vezes, trabalho na origem (se ela conseguir saber o ETag sem gerar a resposta inteira, por exemplo a partir de um número de versão na base de dados). A alternativa mais antiga é o `Last-Modified` / `If-Modified-Since`, com a precisão de um segundo; quando os dois vêm no pedido, o `If-None-Match` ganha.

Um ETag com `W/` à frente é "fraco": diz que o conteúdo é **equivalente**, não idêntico byte a byte (por exemplo, a mesma resposta comprimida com gzip ou com brotli).

O ETag também serve para **controlo de concorrência** nas escritas: `PUT` com `If-Match: "a1b2c3"` só atualiza se ninguém tiver mudado o recurso entretanto, e senão a origem responde `412 Precondition Failed`. É o bloqueio otimista do módulo 38, em HTTP.

## 5. `Vary`: a mesma URL, respostas diferentes

Se a API responde em português ou em inglês conforme o `Accept-Language`, a mesma URL tem duas respostas. Sem avisar a cache, ela guarda a primeira e serve-a a toda a gente. O cabeçalho `Vary: Accept-Language` diz que a chave da cache inclui esse cabeçalho do pedido.

Cuidado com o que se põe no `Vary`: `Vary: User-Agent` cria uma entrada por cada versão de cada browser (milhares), e a taxa de *hits* cai para quase zero; `Vary: Cookie` faz o mesmo. Nos dados por utilizador, `private` é a resposta certa, não o `Vary`. O caso mais comum e inofensivo é `Vary: Accept-Encoding`, que os servidores põem sozinhos.

## 6. CDN: o que mais faz, e o perigo

Uma CDN é uma rede de servidores de cache em centenas de cidades (os **PoPs**, *points of presence*), à frente da origem. Além de cachear, termina o TLS perto do utilizador (o *handshake*, módulo 25, faz-se a 10 ms em vez de a 150 ms), absorve ataques DDoS, comprime, e cada vez mais corre código no limite da rede (*edge functions*).

O perigo é cachear o que não devia: uma resposta com dados de um utilizador, guardada como pública, servida a todos os outros. Já aconteceu a empresas grandes, normalmente por uma regra de CDN do tipo "cachear tudo o que acaba em `.css`" combinada com uma rota que aceitava `/conta/perfil.css` (a *web cache deception*). As defesas: `private` ou `no-store` em tudo o que é personalizado, a CDN a **respeitar** os cabeçalhos da origem em vez de regras próprias, e nunca cachear respostas com `Set-Cookie`.

## 7. Invalidar

> "Há duas coisas difíceis em ciência da computação: invalidar caches e dar nomes às coisas." (Phil Karlton)

Por ordem de preferência:

1. **Não ter de invalidar:** nomes com hash (secção 3). Uma versão nova é um URL novo.
2. **Tempos de vida curtos** com `stale-while-revalidate`: a informação fica no máximo uns segundos desatualizada, e ninguém espera pela origem.
3. **Purgar** explicitamente, quando os dados mudam: por URL (fácil, mas uma tarefa aparece em várias páginas: a dela, a lista do projeto, a pesquisa) ou, melhor, por **etiquetas** (*surrogate keys* ou *cache tags*): cada resposta leva etiquetas (`tarefa:42 projeto:7`), e "a tarefa 42 mudou" purga todas as respostas com essa etiqueta, em todos os PoPs, em segundos. A Fastly, a Cloudflare e o Varnish suportam-no.

---

## Prática: escreve tu

A cache HTTP, de ponta a ponta: interpretar o `Cache-Control` e calcular o tempo de vida (do browser e de uma CDN), um servidor que responde `304` com ETag e `Last-Modified`, uma cache partilhada com `Vary`, revalidação e `stale-if-error`, e a invalidação com nomes com hash e purgas por etiqueta.

**Ficheiros:** `pratica/43-cache-http-e-cdn/` (`cacheControl.js`, `condicional.js`, `cacheHttp.js`, `invalidacao.js`)

**Verificar:** `npm run verificar 43` (dentro de `pratica/`). Só um exercício: `npm run verificar 43 cacheControl`, `... 43 condicional`, `... 43 cacheHttp` ou `... 43 invalidacao`. O P3 usa o `tempoDeVida` do P1, por isso faz o P1 primeiro.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Cache-Control (≈20 min)

**Ficheiro:** `cacheControl.js`

Ler as diretivas, calcular o tempo de vida para o browser e para uma CDN (com `private`, `s-maxage` e `Expires`), e a tabela de políticas da secção 3.

**Sintaxe que vais praticar:** `split` com resto (`const [nome, ...resto] = ...`), `replace` com um grupo, `Date.parse`, `Object.hasOwn` (para `'toString'` não ser um tipo válido).

<details>
<summary>Pista</summary>

Um valor pode ter `=` lá dentro, por isso junta o resto com `resto.join('=')`. No `tempoDeVida`, segue as regras pela ordem dos comentários, com um `return` em cada uma.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Ler o Cache-Control e calcular quanto tempo uma resposta pode ser reutilizada.

// interpretarCacheControl(texto) → objeto com as diretivas
//   'public, max-age=60, s-maxage="300", no-cache' → { public: true, 'max-age': 60, 's-maxage': 300, 'no-cache': true }
//   Nomes em minúsculas; valores sem aspas; valores só com algarismos viram números; diretivas
//   sem valor ficam true; espaços e entradas vazias ignorados. undefined ou '' → {}.
export function interpretarCacheControl(texto = '') {
  const r = {};
  for (const parte of texto.split(',')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (!nome) continue;
    if (resto.length === 0) {
      r[nome.toLowerCase()] = true;
      continue;
    }
    const valor = resto.join('=').trim().replace(/^"(.*)"$/, '$1');
    r[nome.toLowerCase()] = /^\d+$/.test(valor) ? Number(valor) : valor;
  }
  return r;
}

// tempoDeVida(cabecalhos, { partilhada = false }) → segundos em que a resposta está "fresca"
//   cabecalhos: objeto com nomes em minúsculas ('cache-control', 'expires', 'date')
//   partilhada: true para uma cache partilhada (CDN, proxy); false para a do browser
//   Regras, por ordem:
//     no-store                         → 0 (não se guarda de todo)
//     partilhada e private             → 0 (só o browser do utilizador pode guardar)
//     partilhada e s-maxage            → s-maxage
//     max-age                          → max-age
//     expires e date                   → (expires − date) em segundos, nunca negativo
//     nada disto                       → 0 (sem heurísticas)
export function tempoDeVida(cabecalhos, { partilhada = false } = {}) {
  const cc = interpretarCacheControl(cabecalhos['cache-control']);
  if (cc['no-store']) return 0;
  if (partilhada && cc.private) return 0;
  if (partilhada && typeof cc['s-maxage'] === 'number') return cc['s-maxage'];
  if (typeof cc['max-age'] === 'number') return cc['max-age'];
  if (cabecalhos.expires && cabecalhos.date) {
    const s = (Date.parse(cabecalhos.expires) - Date.parse(cabecalhos.date)) / 1000;
    return Number.isNaN(s) ? 0 : Math.max(0, s);
  }
  return 0;
}

// politica(tipo) → o Cache-Control recomendado para cada tipo de recurso:
//   'estatico-com-hash' (app.3f2a9c1b.js)  → 'public, max-age=31536000, immutable'
//   'html'                                → 'no-cache'   (guarda, mas revalida SEMPRE antes de usar)
//   'api-publica'                         → 'public, max-age=60, s-maxage=300, stale-while-revalidate=30'
//   'api-privada'                         → 'private, no-cache'
//   'sensivel'  (dados bancários, tokens)  → 'no-store'
//   outro                                 → lança um Error
export function politica(tipo) {
  const politicas = {
    'estatico-com-hash': 'public, max-age=31536000, immutable',
    html: 'no-cache',
    'api-publica': 'public, max-age=60, s-maxage=300, stale-while-revalidate=30',
    'api-privada': 'private, no-cache',
    sensivel: 'no-store',
  };
  if (!Object.hasOwn(politicas, tipo)) throw new Error(`Tipo desconhecido: ${tipo}`);
  return politicas[tipo];
}
```
</details>

### P2 · ETag e 304 (≈25 min)

**Ficheiro:** `condicional.js`

Um ETag forte a partir do conteúdo, a comparação fraca do `If-None-Match` (com listas e `*`), e um *handler* HTTP que responde `304` quando pode, com o `If-None-Match` a ganhar ao `If-Modified-Since`.

**Sintaxe que vais praticar:** `createHash('sha1').digest('base64url')`, `res.setHeader`/`res.statusCode`/`res.end` do `node:http`, `toUTCString`, arredondar milissegundos a segundos.

<details>
<summary>Pista</summary>

Os validadores (`ETag`, `Last-Modified`, `Cache-Control`) vão em todas as respostas, incluindo o `304`: é assim que a cache sabe que a cópia continua válida. Para o `If-Modified-Since`, compara `Math.floor(ms / 1000)` dos dois lados.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Pedidos condicionais: ETag, Last-Modified e o 304 Not Modified.
import { createHash } from 'node:crypto';

// etag(corpo) → '"<hash>"': os primeiros 16 caracteres do SHA-1 do corpo em base64url, entre aspas
//   (um ETag "forte": muda sempre que o conteúdo muda).
export function etag(corpo) {
  return `"${createHash('sha1').update(corpo).digest('base64url').slice(0, 16)}"`;
}

// corresponde(ifNoneMatch, atual) → true se o cabeçalho If-None-Match corresponder ao ETag atual
//   O cabeçalho pode ter uma lista ('"a", W/"b"') ou '*' (qualquer um). A comparação é "fraca":
//   ignora o prefixo W/ dos dois lados.
export function corresponde(ifNoneMatch, atual) {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  const semW = (t) => t.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some((t) => semW(t) === semW(atual));
}

// responder(req, res, { corpo, modificadoEm, cacheControl, tipo = 'application/json' })
//   Envia SEMPRE os cabeçalhos ETag, Last-Modified (modificadoEm, um Date, em toUTCString()) e
//   Cache-Control. Depois:
//   - se o pedido tiver If-None-Match: 304 sem corpo se corresponder, senão 200 com o corpo
//     (o If-Modified-Since é IGNORADO quando há If-None-Match)
//   - senão, se tiver If-Modified-Since e o recurso não tiver mudado desde essa data (comparando
//     ao segundo, que é a precisão do cabeçalho): 304 sem corpo
//   - senão: 200 com o corpo e o Content-Type
//   Só se aplica a GET e HEAD; outros métodos recebem sempre 200 (num HEAD, o 200 vai sem corpo).
export function responder(req, res, { corpo, modificadoEm, cacheControl, tipo = 'application/json' }) {
  const atual = etag(corpo);
  res.setHeader('ETag', atual);
  res.setHeader('Last-Modified', modificadoEm.toUTCString());
  res.setHeader('Cache-Control', cacheControl);
  const condicional = req.method === 'GET' || req.method === 'HEAD';
  const inm = req.headers['if-none-match'];
  const ims = req.headers['if-modified-since'];
  let naoMudou = false;
  if (condicional && inm !== undefined) naoMudou = corresponde(inm, atual);
  else if (condicional && ims !== undefined) {
    const desde = Date.parse(ims);
    naoMudou = !Number.isNaN(desde) && Math.floor(modificadoEm.getTime() / 1000) <= Math.floor(desde / 1000);
  }
  if (naoMudou) {
    res.statusCode = 304;
    return res.end();
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', tipo);
  res.end(req.method === 'HEAD' ? undefined : corpo);
}
```
</details>

### P3 · Uma cache partilhada (≈40 min)

**Ficheiro:** `cacheHttp.js`

Uma pequena CDN à frente de uma origem: *hits* enquanto a resposta está fresca, revalidação com `If-None-Match`, entradas separadas pelo `Vary`, e `stale-if-error` quando a origem falha.

**Sintaxe que vais praticar:** `Map` com chaves compostas (`JSON.stringify([url, ...valores])`), um relógio injetado, `try/catch` à volta de um `await`, *spread* de objetos para juntar cabeçalhos.

<details>
<summary>Pista</summary>

O `Vary` só se conhece depois da primeira resposta, por isso guarda duas coisas: por URL, a lista de cabeçalhos do `Vary`; e por chave completa (URL mais os valores desses cabeçalhos), a entrada. Na entrada, guarda o instante em que foi guardada e o tempo de vida; a idade é `(agora() - guardadaEm) / 1000`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Uma cache partilhada (o que uma CDN ou um proxy faz), à frente de uma origem.
import { interpretarCacheControl, tempoDeVida } from './cacheControl.js';

// criarCacheHttp({ origem, agora = Date.now }) → { obter(url, cabecalhosPedido = {}) }
//   origem: async (url, cabecalhosPedido) → { estado, cabecalhos, corpo } (cabeçalhos em minúsculas)
//   agora: função que dá o tempo em milissegundos (os testes usam um relógio falso)
//   obter → { estado, cabecalhos, corpo, cache } em que cache é 'MISS' | 'HIT' | 'REVALIDADA' | 'OBSOLETA'
//
//   Chave da cache: o url mais, se a resposta guardada tiver Vary (ex.: 'accept-language'), os
//   valores desses cabeçalhos do pedido. (Guarda por url a lista de cabeçalhos do Vary, e a chave
//   completa é o url com esses valores.)
//   - Só se guardam respostas 200 com tempoDeVida(..., { partilhada: true }) > 0, ou com ETag
//     (essas podem ser revalidadas mesmo com tempo de vida 0, como as de 'no-cache'). Nunca as 'no-store'.
//   - Entrada fresca → devolve-a, cache 'HIT', sem chamar a origem.
//   - Entrada expirada com ETag → chama a origem com If-None-Match; se vier 304, a entrada volta a
//     estar fresca (a contar de agora; usa o Cache-Control do 304 se tiver, senão o guardado) e
//     devolve-se o corpo guardado com cache 'REVALIDADA'; se vier outra coisa, trata-se como um MISS.
//   - Se a origem lançar um erro e houver uma entrada expirada há menos segundos do que o
//     stale-if-error do seu Cache-Control → devolve-a com cache 'OBSOLETA'. Senão, o erro propaga.
//   - O resto é 'MISS': pede à origem, guarda se puder, devolve.
export function criarCacheHttp({ origem, agora = Date.now }) {
  const vary = new Map(); // url → [cabeçalhos]
  const entradas = new Map(); // chave → { resposta, guardadaEm, vida }
  const chave = (url, cab, nomes) => JSON.stringify([url, ...nomes.map((n) => cab[n] ?? '')]);
  const lerVary = (r) => (r.cabecalhos.vary ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);

  function guardar(url, cab, resposta) {
    const cc = interpretarCacheControl(resposta.cabecalhos['cache-control']);
    const vida = tempoDeVida(resposta.cabecalhos, { partilhada: true });
    if (resposta.estado !== 200 || cc['no-store'] || (vida === 0 && !resposta.cabecalhos.etag)) return;
    const nomes = lerVary(resposta);
    vary.set(url, nomes);
    entradas.set(chave(url, cab, nomes), { resposta, guardadaEm: agora(), vida });
  }

  return {
    async obter(url, cab = {}) {
      const k = chave(url, cab, vary.get(url) ?? []);
      const e = entradas.get(k);
      const idade = e ? (agora() - e.guardadaEm) / 1000 : 0;
      if (e && idade < e.vida) return { ...e.resposta, cache: 'HIT' };
      let resposta;
      try {
        const extra = e?.resposta.cabecalhos.etag ? { 'if-none-match': e.resposta.cabecalhos.etag } : {};
        resposta = await origem(url, { ...cab, ...extra });
      } catch (erro) {
        const sie = e && interpretarCacheControl(e.resposta.cabecalhos['cache-control'])['stale-if-error'];
        if (typeof sie === 'number' && idade - e.vida < sie) return { ...e.resposta, cache: 'OBSOLETA' };
        throw erro;
      }
      if (e && resposta.estado === 304) {
        const cabecalhos = resposta.cabecalhos['cache-control']
          ? { ...e.resposta.cabecalhos, 'cache-control': resposta.cabecalhos['cache-control'] }
          : e.resposta.cabecalhos;
        const atualizada = { ...e.resposta, cabecalhos };
        entradas.set(k, { resposta: atualizada, guardadaEm: agora(), vida: tempoDeVida(cabecalhos, { partilhada: true }) });
        return { ...atualizada, cache: 'REVALIDADA' };
      }
      guardar(url, cab, resposta);
      return { ...resposta, cache: 'MISS' };
    },
  };
}
```
</details>

### P4 · Invalidar (≈25 min)

**Ficheiro:** `invalidacao.js`

Nomes de ficheiros com hash (como os do build do Vite), reescrever as referências no HTML, e uma CDN de brincar com purgas por URL e por etiqueta.

**Sintaxe que vais praticar:** `lastIndexOf` para a extensão e para a pasta, `replace` com uma função, três `Map`s que se mantêm coerentes (URL → corpo, URL → etiquetas, etiqueta → URLs).

<details>
<summary>Pista</summary>

A extensão é o que vem depois do último ponto, mas só se esse ponto estiver depois da última `/` e não for o primeiro carácter do nome (`.env` não tem extensão). Na CDN, escreve primeiro o `purgarUrl`, que limpa as três estruturas, e usa-o no `guardar` (para substituir) e no `purgarEtiqueta`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Invalidar: nomes com hash para os ficheiros estáticos, e purgas por etiqueta numa CDN.
import { createHash } from 'node:crypto';

// nomeComHash(nome, conteudo) → 'app.3f2a9c1b.js': os primeiros 8 caracteres hexadecimais do
//   SHA-256 do conteúdo, antes da ÚLTIMA extensão. Sem extensão: 'LICENSE' → 'LICENSE.3f2a9c1b'.
//   Com pastas: 'js/app.min.js' → 'js/app.min.<hash>.js'.
export function nomeComHash(nome, conteudo) {
  const h = createHash('sha256').update(conteudo).digest('hex').slice(0, 8);
  const barra = nome.lastIndexOf('/');
  const ponto = nome.lastIndexOf('.');
  if (ponto <= barra + 1) return `${nome}.${h}`;
  return `${nome.slice(0, ponto)}.${h}${nome.slice(ponto)}`;
}

// reescreverReferencias(html, mapa) → o html com cada atributo src="..." ou href="..." cujo valor
//   esteja no mapa (nome original → nome com hash) trocado. Os outros ficam como estão.
export function reescreverReferencias(html, mapa) {
  return html.replace(/\b(src|href)="([^"]*)"/g, (m, attr, v) => (Object.hasOwn(mapa, v) ? `${attr}="${mapa[v]}"` : m));
}

// criarCdn() → { guardar(url, corpo, etiquetas = []), obter(url), purgarUrl(url), purgarEtiqueta(etiqueta), get tamanho }
//   Uma CDN de brincar: guardar associa o url às etiquetas (as "surrogate keys" / "cache tags":
//   ex.: a página de uma tarefa tem as etiquetas ['tarefa:42', 'projeto:7']).
//   obter → o corpo guardado, ou undefined
//   purgarUrl → 1 se apagou, 0 se não havia
//   purgarEtiqueta → quantos urls apagou (todos os que tinham a etiqueta)
//   Voltar a guardar um url substitui o corpo E as etiquetas.
export function criarCdn() {
  const corpos = new Map(); // url → corpo
  const etiquetasDe = new Map(); // url → Set(etiquetas)
  const urlsDe = new Map(); // etiqueta → Set(urls)
  function purgarUrl(url) {
    if (!corpos.has(url)) return 0;
    for (const e of etiquetasDe.get(url)) {
      const urls = urlsDe.get(e);
      urls.delete(url);
      if (urls.size === 0) urlsDe.delete(e);
    }
    corpos.delete(url);
    etiquetasDe.delete(url);
    return 1;
  }
  return {
    guardar(url, corpo, etiquetas = []) {
      purgarUrl(url);
      corpos.set(url, corpo);
      etiquetasDe.set(url, new Set(etiquetas));
      for (const e of etiquetas) {
        if (!urlsDe.has(e)) urlsDe.set(e, new Set());
        urlsDe.get(e).add(url);
      }
    },
    obter: (url) => corpos.get(url),
    purgarUrl,
    purgarEtiqueta(etiqueta) {
      const urls = [...(urlsDe.get(etiqueta) ?? [])];
      return urls.reduce((n, u) => n + purgarUrl(u), 0);
    },
    get tamanho() {
      return corpos.size;
    },
  };
}
```
</details>

## Experiências

1. **O separador Network:** abre o frontend do workshop com as ferramentas do browser, separador *Network*. Recarrega com e sem "Disable cache". Que pedidos vêm `(memory cache)`, `(disk cache)`, `304`? Que `Cache-Control` tem o `index.html` e os ficheiros JS?
2. **ETag na API:** acrescenta o `responder` do P2 à listagem de tarefas, e faz dois pedidos com `curl -i` (o segundo com `-H 'If-None-Match: ...'`).
3. **O Nginx como cache:** configura `proxy_cache_path` e `proxy_cache` no Nginx do workshop para uma rota pública da API, acrescenta `add_header X-Cache $upstream_cache_status;`, e vê o `MISS`, o `HIT` e o `EXPIRED` com `curl -i`.
4. **`immutable` vs. recarregar:** num ficheiro com `max-age=3600` sem `immutable`, recarrega a página e vê se o browser faz um pedido condicional. Repete com `immutable`.

## Perguntas de pensamento crítico

1. Depois de um deploy, alguns utilizadores ficam com o frontend partido: o HTML novo pede ficheiros JS que já não existem, ou o HTML antigo pede os novos. O que está mal nos cabeçalhos de cache, e como corriges?
2. Qual é a diferença entre `no-cache` e `no-store`, e quando usarias cada um?
3. Uma resposta da API com o perfil do utilizador foi parar à CDN e foi servida a outros utilizadores. Que cabeçalhos teriam evitado isto, e que outras defesas pões?

<details>
<summary>Respostas</summary>

1. O HTML está a ser cacheado (com um `max-age`, ou por heurística porque não tem `Cache-Control`), por isso os utilizadores continuam a receber o HTML antigo, que aponta para ficheiros com hash que o deploy apagou; ou o contrário, se os ficheiros JS tiverem nomes fixos e forem cacheados. A correção: o HTML com `no-cache` (sempre revalidado), os ficheiros estáticos com hash no nome e `max-age=31536000, immutable`, e manter os ficheiros da versão anterior no servidor durante algum tempo depois de cada deploy, para quem ainda tem o HTML antigo aberto.
2. `no-cache` deixa guardar a resposta, mas obriga a revalidar com a origem antes de cada uso (com o ETag, a resposta é um `304` pequeno se não mudou); serve para o HTML e para dados que têm de estar sempre atualizados mas que poupam muito com o `304`. `no-store` proíbe guardar em qualquer lado, incluindo o disco do browser; serve para dados sensíveis (extratos, tokens, dados de saúde).
3. `Cache-Control: private, no-cache` (ou `no-store`) na resposta: `private` proíbe as caches partilhadas de a guardar. Outras defesas: a CDN configurada para respeitar os cabeçalhos da origem (e não regras por extensão ou por caminho), nunca cachear respostas com `Set-Cookie` ou a pedidos com `Authorization`, separar as rotas públicas das autenticadas (outro prefixo ou outro domínio), e um teste automático que verifica o `Cache-Control` das rotas autenticadas.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 43`.

**1.** O que significa Cache-Control: no-cache?

- a) Não guardar a resposta em lado nenhum
- b) Pode guardar, mas tem de revalidar com a origem antes de cada uso
- c) Só a CDN pode guardar
- d) Guardar durante 0 segundos e depois apagar

<details><summary>Resposta</summary>

**b) Pode guardar, mas tem de revalidar com a origem antes de cada uso** — Para não guardar de todo é no-store.

</details>

**2.** Que Cache-Control usarias para app.3f2a9c1b.js (nome com hash)?

- a) no-cache
- b) private, max-age=60
- c) public, max-age=31536000, immutable
- d) no-store

<details><summary>Resposta</summary>

**c) public, max-age=31536000, immutable** — Uma versão nova tem um nome novo, por isso este ficheiro nunca muda.

</details>

**3.** Que código de estado responde a origem quando o If-None-Match corresponde ao ETag atual?

<details><summary>Resposta</summary>

**304** — Sem corpo: a cache usa a cópia que tem.

</details>

**4.** Para que serve o cabeçalho Vary: Accept-Language?

- a) Para comprimir a resposta
- b) Para a cache guardar uma entrada por cada valor do Accept-Language do pedido
- c) Para mudar a língua do servidor
- d) Para proibir a cache

<details><summary>Resposta</summary>

**b) Para a cache guardar uma entrada por cada valor do Accept-Language do pedido** — Sem ele, a cache serviria a primeira língua a toda a gente.

</details>

**5.** Que diretiva impede uma CDN de guardar uma resposta, mas deixa o browser guardá-la?

- a) public
- b) private
- c) immutable
- d) s-maxage=0

<details><summary>Resposta</summary>

**b) private** — private: só a cache do próprio utilizador.

</details>

<!-- quiz:end -->
