# 27 · Sessões, cookies e tokens

**Objetivo:** guardar a autenticação no browser de forma segura: cookies `HttpOnly`, `Secure` e `SameSite`, sessões no servidor, tokens de acesso curtos com tokens de renovação que rodam, o padrão BFF, e a defesa contra CSRF que os cookies passam a exigir. É a resposta ao "o token vai no `localStorage`" que o módulo 15 deixou em aberto.

**Ficheiros para ler:** `src/web/src/oidc.js` e `src/web/src/api.js` (onde o frontend guarda e envia o token hoje) e `src/api/src/middleware/auth.js`.

**Pré-requisitos:** módulos 15 (autenticação: JWT e Keycloak) e 26 (OWASP: XSS e CSRF).

---

## 1. O problema do `localStorage`

O frontend do workshop guarda o token no `localStorage` e envia-o num cabeçalho `Authorization`. É simples e funciona, mas tem um ponto fraco: **qualquer JavaScript que corra na página consegue lê-lo**. Basta uma falha de XSS (módulo 26), ou uma biblioteca de terceiros comprometida (um pacote do npm, um script de analítica), para o token ser copiado e usado a partir de outra máquina até expirar. E um JWT normal não se revoga: vale até ao fim do `exp`.

A alternativa que os guias de segurança (OWASP, o *OAuth 2.0 for Browser-Based Apps* do IETF) recomendam para aplicações web é tirar o segredo do alcance do JavaScript: **um cookie `HttpOnly`**, que o browser envia sozinho e que nenhum script consegue ler.

## 2. Os atributos de um cookie

```
Set-Cookie: __Host-sessao=k3J9...; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax
```

| Atributo | O que faz |
|---|---|
| `HttpOnly` | o JavaScript da página não o lê (`document.cookie` não o mostra): um XSS não o rouba |
| `Secure` | só é enviado por HTTPS |
| `SameSite=Lax` | não vai em pedidos vindos de outros sites, exceto navegações de topo com `GET` (clicar num link). `Strict`: nem isso. `None`: vai sempre (e exige `Secure`) |
| `Max-Age` / `Expires` | quando expira; sem eles, é um cookie "de sessão" que morre ao fechar o browser (mais ou menos: os browsers restauram sessões) |
| `Domain` | sem ele, só este anfitrião exato; com ele, também os subdomínios (cuidado: um subdomínio comprometido passa a recebê-lo) |
| `Path` | o caminho a partir do qual é enviado (não é uma fronteira de segurança) |

Os **prefixos** são garantias que o browser verifica: um cookie chamado `__Secure-x` só é aceite com `Secure`; um `__Host-x` só com `Secure`, `Path=/` e **sem** `Domain`, o que impede um subdomínio de o sobrepor. Para o cookie de sessão, `__Host-` é a melhor escolha.

## 3. Sessões no servidor ou tokens?

Há duas formas de o cookie representar o utilizador:

- **Sessão no servidor**: o cookie leva só um **id aleatório** (32 bytes, impossível de adivinhar), e o servidor guarda a sessão (no Redis, módulo 05, ou na base de dados). Revogar é apagar a linha: "terminar sessão em todos os dispositivos" e "depois de mudar a password, sai de todo o lado" são triviais. O custo é uma leitura ao armazenamento por pedido.
- **Token no cookie** (por exemplo, o JWT dentro de um cookie `HttpOnly`): o servidor não guarda nada, mas volta o problema da revogação.

Para quase todas as aplicações web, **sessões no servidor são a escolha certa**. Os JWT brilham entre serviços (módulo 15: o Keycloak emite, a API e os outros serviços verificam com a chave pública), não como sessão do browser.

Regras de uma sessão bem feita:

- **Expiração por inatividade** (por exemplo, 30 minutos sem uso) **e máxima** (8 horas, mesmo com uso): uma sessão roubada não vive para sempre.
- **Rodar o id** depois do login e de qualquer mudança de privilégios. Se o id antes do login fosse o mesmo depois dele, um atacante que conseguisse plantar um id no browser da vítima (a **fixação de sessão**) ficava com a sessão autenticada dela.
- **Logout a sério**: apagar a sessão no servidor, não só o cookie.

## 4. Tokens de acesso e de renovação

Quando há mesmo tokens (uma app móvel, uma SPA que fala com várias APIs, o OIDC do módulo 15), o padrão é:

- um **token de acesso** curto (5 a 15 minutos), enviado a cada pedido;
- um **token de renovação** (*refresh token*) longo, usado **só** para obter um token de acesso novo, guardado no sítio mais protegido possível.

Os tokens de renovação **rodam**: cada renovação devolve um token de renovação novo e gasta o anterior. E isso dá uma deteção de roubo de graça: se um token **já gasto** aparecer outra vez, alguém tem uma cópia (o utilizador legítimo e o atacante usaram o mesmo token). Como não se sabe qual dos dois é o atacante, revoga-se a **família** inteira (todos os tokens descendentes daquele login), e o utilizador tem de voltar a entrar. É o que o Keycloak, o Auth0 e o Okta fazem com a "rotação com deteção de reutilização".

## 5. O padrão BFF

Para uma SPA, a recomendação atual é o **BFF** (*Backend for Frontend*): um pequeno servidor, no mesmo domínio que a SPA, que faz o fluxo OIDC (módulo 15) com o Keycloak, **guarda os tokens do lado do servidor**, e dá ao browser só um cookie de sessão `__Host-` `HttpOnly`. Os pedidos da SPA vão para o BFF (com o cookie), e o BFF acrescenta o token de acesso e reencaminha para as APIs. O browser nunca vê um token. No workshop, o Nginx (módulo 10) já faz de "porta única" para a API; um BFF seria um serviço no lugar dele para as rotas `/api`.

## 6. O preço dos cookies: CSRF

Com um cookie, o browser envia a autenticação **sozinho**, em qualquer pedido para o teu site, incluindo um formulário escondido num site malicioso que faz `POST /api/tasks/42/delete` quando a vítima o abre. É o **CSRF** (*cross-site request forgery*, módulo 26). Com o token no cabeçalho `Authorization`, isto não acontecia, porque o site malicioso não o tem.

As defesas, em camadas:

1. **`SameSite=Lax`** (o valor por omissão dos browsers modernos): o cookie não vai nos `POST` vindos de outros sites. Resolve a maioria dos casos, mas não protege contra subdomínios do mesmo site (`SameSite` olha para o "site", não para a origem exata), nem contra ações feitas com `GET`.
2. **Verificar a origem** de cada pedido que muda alguma coisa: o cabeçalho `Sec-Fetch-Site` (`same-origin`, `same-site`, `cross-site`, `none`), que os browsers modernos enviam e um site não consegue falsificar, ou, em alternativa, o `Origin` e o `Referer`. Na dúvida, recusa.
3. **Um token CSRF**: um valor ligado à sessão (por exemplo, um HMAC do id da sessão), que a página recebe e envia num cabeçalho `X-CSRF-Token`. Um site alheio não o consegue ler (por causa da política de mesma origem), por isso não o consegue enviar.
4. **Nunca mudar estado com `GET`.**

## Em resumo

- O `localStorage` está ao alcance de qualquer script da página: um XSS leva o token. Um cookie **`HttpOnly`** não pode ser lido pelo JavaScript.
- Um cookie de sessão bem feito é `__Host-`, `HttpOnly`, `Secure` e `SameSite=Lax`; os prefixos são garantias que o browser verifica.
- **Sessões no servidor** (o cookie leva só um id aleatório) revogam-se apagando uma linha; expiram por inatividade **e** ao fim de um tempo máximo, e o id **roda** depois do login.
- Tokens de acesso curtos e tokens de renovação que **rodam**: um token gasto que reaparece prova que houve cópia, e revoga-se a família inteira.
- Numa SPA, o padrão recomendado é o **BFF**: um servidor no mesmo domínio guarda os tokens, e o browser só tem um cookie.
- Com cookies vem o **CSRF**: `SameSite`, verificar a origem (`Sec-Fetch-Site`), um token CSRF e nunca mudar estado com `GET`.

---

## Prática: escreve tu

As peças de uma autenticação com cookies: escrever e ler cookies com as regras dos prefixos, um armazém de sessões com as duas expirações e rotação de ids, tokens de renovação com rotação e deteção de reutilização, e as duas defesas contra CSRF.

**Ficheiros:** `pratica/27-sessoes-e-tokens/` (`cookies.js`, `sessoes.js`, `renovacao.js`, `csrf.js`)

**Verificar:** `npm run verificar 27` (dentro de `pratica/`). Só um exercício: `npm run verificar 27 cookies`, `... 27 sessoes`, `... 27 renovacao` ou `... 27 csrf`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Cookies seguros (≈20 min)

**Ficheiro:** `cookies.js`

Montar o `Set-Cookie` com os atributos pela ordem certa, recusar as combinações que os browsers rejeitam (`SameSite=None` sem `Secure`, os prefixos), e ler o cabeçalho `Cookie`.

**Sintaxe que vais praticar:** desestruturação de opções, `encodeURIComponent`/`decodeURIComponent` com `try/catch`, `indexOf` para partir só no primeiro `=`, `Object.hasOwn`.

<details>
<summary>Pista</summary>

Valida tudo primeiro (nome, `SameSite`, prefixos) e só depois monta o texto, acrescentando cada atributo com um `if`. Ao ler, parte cada pedaço no **primeiro** `=` (um valor pode ter `=` lá dentro).
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Cookies seguros: escrever o Set-Cookie e ler o Cookie.

// serializarCookie(nome, valor, opcoes) → o valor do cabeçalho Set-Cookie
//   opcoes: { httpOnly, secure, sameSite ('Strict' | 'Lax' | 'None'), path, domain, maxAge (segundos) }
//   Formato: 'nome=valor' (valor com encodeURIComponent) e depois, por esta ordem e só os que
//   existem: '; Max-Age=N', '; Domain=d', '; Path=p', '; HttpOnly', '; Secure', '; SameSite=S'.
//   Regras (lança um Error com uma mensagem que diga o problema):
//   - o nome só pode ter letras, algarismos, '_' e '-' (os prefixos '__Host-' e '__Secure-' também)
//   - SameSite=None exige Secure (os browsers rejeitam o cookie sem ele)
//   - o prefixo '__Secure-' exige Secure
//   - o prefixo '__Host-' exige Secure, Path=/ e NENHUM Domain (fica preso a este anfitrião exato)
export function serializarCookie(nome, valor, opcoes = {}) {
  const { httpOnly, secure, sameSite, path, domain, maxAge } = opcoes;
  if (!/^[\w-]+$/.test(nome)) throw new Error(`Nome de cookie inválido: ${nome}`);
  if (sameSite === 'None' && !secure) throw new Error('SameSite=None exige Secure');
  if (nome.startsWith('__Secure-') && !secure) throw new Error('O prefixo __Secure- exige Secure');
  if (nome.startsWith('__Host-') && (!secure || path !== '/' || domain)) {
    throw new Error('O prefixo __Host- exige Secure, Path=/ e nenhum Domain');
  }
  let c = `${nome}=${encodeURIComponent(valor)}`;
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (domain) c += `; Domain=${domain}`;
  if (path) c += `; Path=${path}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  if (sameSite) c += `; SameSite=${sameSite}`;
  return c;
}

// lerCookies(cabecalho) → { nome: valor } a partir do cabeçalho Cookie ('a=1; b=x%20y')
//   Valores descodificados com decodeURIComponent (um valor mal codificado fica como veio);
//   se um nome se repetir, ganha o PRIMEIRO; pedaços sem '=' ignoram-se; sem cabeçalho → {}.
export function lerCookies(cabecalho = '') {
  const r = {};
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    if (!nome || Object.hasOwn(r, nome)) continue;
    const bruto = parte.slice(i + 1).trim();
    try {
      r[nome] = decodeURIComponent(bruto);
    } catch {
      r[nome] = bruto;
    }
  }
  return r;
}
```
</details>

### P2 · Sessões no servidor (≈25 min)

**Ficheiro:** `sessoes.js`

Ids aleatórios, expiração por inatividade e máxima (com o relógio injetado), rotação do id contra a fixação de sessão, e terminar uma ou todas as sessões de um utilizador.

**Sintaxe que vais praticar:** `randomBytes(32).toString('base64url')`, um `Map` com objetos mutáveis, uma função auxiliar partilhada (`valida`), percorrer um `Map` enquanto se apaga.

<details>
<summary>Pista</summary>

Guarda, por id, o utilizador, o instante em que a sessão foi criada e o do último uso. Uma função `valida(id)` verifica as duas expirações e apaga a sessão se tiver expirado; `obter` e `rodar` usam-na. Rodar é apagar a entrada antiga e criar uma nova com os mesmos dados.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Sessões guardadas no servidor (o cookie só leva um id aleatório).
import { randomBytes } from 'node:crypto';

// criarSessoes({ agora = Date.now, inatividadeMs, maximoMs }) → {
//   criar(utilizador) → id: 32 bytes aleatórios em base64url (impossível de adivinhar)
//   obter(id) → { utilizador, criadaEm } ou null. A sessão expira se passar inatividadeMs desde o
//      último uso OU maximoMs desde que foi criada (uma sessão roubada não vive para sempre).
//      Cada obter com sucesso conta como uso (renova a inatividade). Expirada → é apagada e dá null.
//   rodar(id) → novo id para a MESMA sessão (mesmo utilizador e mesmo criadaEm); o id antigo deixa de
//      valer. Faz-se depois do login e de mudar privilégios (contra a "fixação de sessão"). id
//      inválido → null.
//   terminar(id)                  → apaga essa sessão (logout)
//   terminarTodas(utilizador) → quantas apagou (ex.: "terminar sessão em todos os dispositivos",
//      ou depois de mudar a password)
// }
export function criarSessoes({ agora = Date.now, inatividadeMs, maximoMs }) {
  const sessoes = new Map(); // id → { utilizador, criadaEm, usadaEm }
  const novoId = () => randomBytes(32).toString('base64url');
  const valida = (id) => {
    const s = sessoes.get(id);
    if (!s) return null;
    const t = agora();
    if (t - s.usadaEm > inatividadeMs || t - s.criadaEm > maximoMs) {
      sessoes.delete(id);
      return null;
    }
    return s;
  };
  return {
    criar(utilizador) {
      const id = novoId();
      sessoes.set(id, { utilizador, criadaEm: agora(), usadaEm: agora() });
      return id;
    },
    obter(id) {
      const s = valida(id);
      if (!s) return null;
      s.usadaEm = agora();
      return { utilizador: s.utilizador, criadaEm: s.criadaEm };
    },
    rodar(id) {
      const s = valida(id);
      if (!s) return null;
      sessoes.delete(id);
      const novo = novoId();
      sessoes.set(novo, { ...s, usadaEm: agora() });
      return novo;
    },
    terminar(id) {
      sessoes.delete(id);
    },
    terminarTodas(utilizador) {
      let n = 0;
      for (const [id, s] of sessoes) {
        if (s.utilizador === utilizador) {
          sessoes.delete(id);
          n++;
        }
      }
      return n;
    },
  };
}
```
</details>

### P3 · Rotação de tokens de renovação (≈30 min)

**Ficheiro:** `renovacao.js`

Pares de tokens por família, tokens de acesso que expiram, renovação que gasta o token usado, e revogação da família inteira quando um token gasto é reutilizado.

**Sintaxe que vais praticar:** dois `Map`s e um `Set` de famílias revogadas, uma função interna que cria um par, classes de erro próprias.

<details>
<summary>Pista</summary>

Cada token (de acesso e de renovação) guarda a família a que pertence. Revogar uma família é pô-la num `Set`; a validação de qualquer token verifica esse `Set`. No `renovar`, a ordem dos testes importa: primeiro "existe, não está revogado, não expirou", depois "já foi gasto?".
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Tokens de acesso curtos + tokens de renovação que rodam, com deteção de reutilização.
import { randomBytes } from 'node:crypto';

export class ErroReutilizacao extends Error {}

// criarEmissor({ agora = Date.now, vidaAcessoS = 900, vidaRenovacaoS = 30 * 24 * 3600 }) → {
//   emitir(utilizador) → { acesso, renovacao } (dois tokens aleatórios novos, de 32 bytes em
//      base64url) que começam uma "família" nova (um login = uma família)
//   validarAcesso(acesso) → utilizador, ou null se não existir ou tiver expirado
//   renovar(renovacao) → { acesso, renovacao } novos, da mesma família; o de renovação usado
//      fica GASTO. Erros:
//      - token desconhecido ou expirado → Error('Token de renovação inválido')
//      - token já GASTO → alguém o copiou (o utilizador legítimo ou o atacante já o tinha usado):
//        revoga a família inteira (todos os seus tokens de acesso e de renovação deixam de valer)
//        e lança ErroReutilizacao
//   revogarFamilia(renovacao) → logout: invalida a família desse token
// }
export function criarEmissor({ agora = Date.now, vidaAcessoS = 900, vidaRenovacaoS = 30 * 24 * 3600 } = {}) {
  const token = () => randomBytes(32).toString('base64url');
  const acessos = new Map(); // token → { utilizador, familia, expira }
  const renovacoes = new Map(); // token → { utilizador, familia, expira, gasto }
  const revogadas = new Set();
  function par(utilizador, familia) {
    const acesso = token();
    const renovacao = token();
    acessos.set(acesso, { utilizador, familia, expira: agora() + vidaAcessoS * 1000 });
    renovacoes.set(renovacao, { utilizador, familia, expira: agora() + vidaRenovacaoS * 1000, gasto: false });
    return { acesso, renovacao };
  }
  return {
    emitir: (utilizador) => par(utilizador, token()),
    validarAcesso(acesso) {
      const a = acessos.get(acesso);
      if (!a || revogadas.has(a.familia) || agora() >= a.expira) return null;
      return a.utilizador;
    },
    renovar(renovacao) {
      const r = renovacoes.get(renovacao);
      if (!r || revogadas.has(r.familia) || agora() >= r.expira) throw new Error('Token de renovação inválido');
      if (r.gasto) {
        revogadas.add(r.familia);
        throw new ErroReutilizacao('Token de renovação reutilizado: a sessão foi revogada');
      }
      r.gasto = true;
      return par(r.utilizador, r.familia);
    },
    revogarFamilia(renovacao) {
      const r = renovacoes.get(renovacao);
      if (r) revogadas.add(r.familia);
    },
  };
}
```
</details>

### P4 · Defesas contra CSRF (≈20 min)

**Ficheiro:** `csrf.js`

Verificar a origem com `Sec-Fetch-Site`, `Origin` e `Referer` (recusando na dúvida), e um token CSRF ligado à sessão, comparado em tempo constante.

**Sintaxe que vais praticar:** `new URL(...).origin` dentro de `try/catch`, `createHmac`, `timingSafeEqual` com a verificação do comprimento.

<details>
<summary>Pista</summary>

Segue a ordem dos comentários e devolve logo em cada regra. Repara no teste do `Referer` com `https://tarefas.exemplo.pt.atacante.exemplo/`: comparar com `startsWith` deixaria passar o atacante; compara a **origem** inteira.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Proteção contra CSRF quando a autenticação vai num cookie.
// Com um cookie, o browser envia-o SOZINHO em qualquer pedido para o teu site, incluindo um
// formulário escondido noutro site. Duas defesas, em camadas: confirmar a origem do pedido, e
// exigir um token que um site alheio não consegue ler.
import { createHmac, timingSafeEqual } from 'node:crypto';

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// origemPermitida({ metodo, cabecalhos }, origensPermitidas) → true/false
//   cabecalhos com nomes em minúsculas.
//   - métodos seguros (GET, HEAD, OPTIONS) → true (não mudam nada)
//   - se houver 'sec-fetch-site': 'same-origin' → true; 'cross-site' ou 'same-site' → false
//     (só 'none', o utilizador a escrever o URL, continua para as regras seguintes)
//   - senão, se houver 'origin': true se estiver na lista
//   - senão, se houver 'referer': true se a origem do referer (new URL(referer).origin) estiver na lista
//   - sem nada disto → false (na dúvida, recusa)
export function origemPermitida({ metodo, cabecalhos }, origensPermitidas) {
  if (SEGUROS.has(metodo)) return true;
  const sfs = cabecalhos['sec-fetch-site'];
  if (sfs === 'same-origin') return true;
  if (sfs === 'cross-site' || sfs === 'same-site') return false;
  if (cabecalhos.origin) return origensPermitidas.includes(cabecalhos.origin);
  if (cabecalhos.referer) {
    try {
      return origensPermitidas.includes(new URL(cabecalhos.referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

// tokenCsrf(sessaoId, segredo) → HMAC-SHA256 do id da sessão com o segredo, em base64url.
//   O servidor dá-o à página (num meta ou numa resposta JSON); a página manda-o de volta num
//   cabeçalho X-CSRF-Token. Um site alheio não o consegue ler nem calcular.
export function tokenCsrf(sessaoId, segredo) {
  return createHmac('sha256', segredo).update(sessaoId).digest('base64url');
}

// validarCsrf({ metodo, cabecalhos }, sessaoId, segredo) → true/false
//   Métodos seguros → true. Senão, o cabeçalho 'x-csrf-token' tem de ser igual a
//   tokenCsrf(sessaoId, segredo), comparado em tempo constante. Sem sessão ou sem token → false.
export function validarCsrf({ metodo, cabecalhos }, sessaoId, segredo) {
  if (SEGUROS.has(metodo)) return true;
  const recebido = cabecalhos['x-csrf-token'];
  if (!sessaoId || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(tokenCsrf(sessaoId, segredo));
  return a.length === b.length && timingSafeEqual(a, b);
}
```
</details>

## Experiências

1. **Roubar o token:** com o frontend do workshop aberto e autenticado, abre a consola do browser e escreve `localStorage`. O que vês? É exatamente o que um XSS veria. Depois, num site com sessão por cookie `HttpOnly`, tenta `document.cookie`.
2. **Os atributos no browser:** no separador *Application* (Chrome) ou *Storage* (Firefox) das ferramentas, olha para os cookies de um site que uses. Que atributos têm? Quais usam os prefixos `__Host-`/`__Secure-`?
3. **CSRF ao vivo:** cria uma página HTML noutra porta com um `<form method="POST" action="http://localhost:8080/api/...">` e um botão. Com um cookie de sessão `SameSite=Lax`, `Strict` e `None`, o que acontece em cada caso? Olha para o `Sec-Fetch-Site` que chega ao servidor.
4. **Sessões no Redis:** reescreve o P2 para guardar as sessões no Redis do workshop (módulo 05), com o `EXPIRE` a tratar da inatividade. Como implementas o `terminarTodas` sem percorrer todas as chaves?

## Perguntas de pensamento crítico

1. Se o cookie `HttpOnly` não pode ser lido por um XSS, quer dizer que um XSS deixa de ser grave?
2. Porque é que a deteção de reutilização revoga a família inteira, incluindo o token de quem pode ser o utilizador legítimo?
3. O `SameSite=Lax` já está ativo por omissão nos browsers. Porque é que ainda se verifica a origem e se usa um token CSRF?

<details>
<summary>Respostas</summary>

1. Não. O atacante deixa de conseguir **levar** a sessão para outra máquina, mas o script dele corre **dentro** da página da vítima, e qualquer `fetch` que faça leva o cookie: pode ler os dados dela, mudar o email, fazer transferências, enquanto a página estiver aberta. O `HttpOnly` reduz o estrago (sem roubo de sessão duradouro), mas o XSS continua a ter de ser evitado na origem (escapar, CSP, módulo 26).
2. Porque, quando um token gasto reaparece, o servidor sabe que há duas cópias, mas não sabe qual delas é a do atacante: o pedido com o token gasto pode ser do utilizador legítimo (cujo token o atacante usou primeiro) ou do atacante. Revogar a família inteira é a única forma de garantir que o atacante perde o acesso; o custo é o utilizador legítimo ter de voltar a fazer login, que é um preço pequeno, e um sinal útil (pode-se avisá-lo).
3. Porque o `SameSite` olha para o **site** (o domínio registável), não para a origem exata: um subdomínio comprometido ou de terceiros (`blog.exemplo.pt`) conta como o mesmo site; o `Lax` deixa passar navegações `GET` (perigoso se alguma ação mudar estado com `GET`); browsers antigos ou configurações diferentes podem não o aplicar; e há exceções (por exemplo, o Chrome deixava, durante uns minutos depois de criado, cookies sem `SameSite` explícito em `POST` de outros sites). As defesas em camadas cobrem as falhas umas das outras.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 27`.

**1.** O que faz o atributo HttpOnly num cookie?

- a) Só é enviado por HTTP, nunca por HTTPS
- b) O JavaScript da página não o consegue ler
- c) Expira ao fechar o browser
- d) Só vai em pedidos do mesmo site

<details><summary>Resposta</summary>

**b) O JavaScript da página não o consegue ler** — Um XSS deixa de conseguir roubar a sessão (mas continua a poder agir na página).

</details>

**2.** Que exige o prefixo __Host- num cookie?

- a) HttpOnly
- b) Secure, Path=/ e nenhum Domain
- c) SameSite=Strict
- d) Max-Age

<details><summary>Resposta</summary>

**b) Secure, Path=/ e nenhum Domain** — Fica preso ao anfitrião exato: um subdomínio não o pode sobrepor.

</details>

**3.** Como se chama o ataque em que um site malicioso faz o browser da vítima enviar um pedido autenticado (com o cookie) para outro site (sigla)?

<details><summary>Resposta</summary>

**csrf** — Defesas: SameSite, verificar a origem (Sec-Fetch-Site), token CSRF, nunca mudar estado com GET.

</details>

**4.** Um token de renovação já gasto volta a ser usado. O que deve o servidor fazer?

- a) Aceitar, se ainda não expirou
- b) Revogar a família inteira de tokens desse login
- c) Ignorar o pedido
- d) Emitir um token novo e avisar o utilizador

<details><summary>Resposta</summary>

**b) Revogar a família inteira de tokens desse login** — Há duas cópias e não se sabe qual é a do atacante.

</details>

**5.** Porque se roda o id da sessão depois do login?

- a) Para poupar memória
- b) Contra a fixação de sessão: um id plantado antes do login não fica autenticado
- c) Porque o cookie expira
- d) Por causa do SameSite

<details><summary>Resposta</summary>

**b) Contra a fixação de sessão: um id plantado antes do login não fica autenticado** — O mesmo se faz quando os privilégios mudam.

</details>

<!-- quiz:end -->
