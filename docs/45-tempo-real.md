# 45 · Tempo real: SSE e WebSockets

**Objetivo:** saber pôr o servidor a enviar dados ao browser sem que ele pergunte: Server-Sent Events para notificações num só sentido, WebSockets para conversas nos dois sentidos, e os problemas que só aparecem em produção (ligações mortas, quedas e reconexão, proxies, escalar para várias réplicas).

**Ficheiros para ler:** `src/web/src/App.jsx` (o frontend faz *polling* às estatísticas) e o exercício D8 do módulo 12.

**Pré-requisitos:** módulos 01 (HTTP), 08 (React), 10 (Nginx) e 25 (redes).

---

## 1. O problema: o HTTP só responde a quem pergunta

No HTTP normal, o browser pergunta e o servidor responde. Se o worker (módulo 07) acabar de processar uma tarefa, o servidor não tem como avisar o browser: tem de esperar que ele pergunte. Há quatro formas de resolver isto:

| Técnica | Como funciona | Bom para | Custo |
|---|---|---|---|
| **Polling** | o browser pergunta de N em N segundos | quase nada muda, ou é um protótipo | pedidos inúteis, e um atraso até N segundos |
| **Long polling** | o browser pergunta, e o servidor só responde quando houver novidades (ou ao fim de um timeout) | sistemas antigos | uma ligação presa por cliente, e lógica complicada |
| **SSE** (*Server-Sent Events*) | uma resposta HTTP que nunca acaba; o servidor escreve eventos quando quer | notificações, feeds, progresso, respostas de LLMs aos bocados | só do servidor para o browser |
| **WebSockets** | uma ligação permanente, nos dois sentidos, com mensagens | chat, jogos, edição colaborativa | um protocolo à parte, mais coisas para gerir |

O frontend deste projeto faz *polling* às estatísticas. Funciona, e para um projeto pequeno é uma escolha razoável (o módulo 13 discute isso). Para notificações instantâneas, o SSE é a opção natural; para um chat, os WebSockets.

## 2. Server-Sent Events

O SSE é só HTTP. O servidor responde com `Content-Type: text/event-stream` e **não fecha a resposta**. Cada evento é um bloco de linhas `campo: valor`, terminado por uma linha em branco:

```
id: 7
event: tarefa-concluida
data: {"id":42,"titulo":"Pagar a luz"}

: isto é um comentário, serve de batimento

data: um evento sem tipo (é "message")
data: com duas linhas de dados

```

No browser, o `EventSource` trata de tudo:

```js
const fonte = new EventSource('/api/eventos');
fonte.addEventListener('tarefa-concluida', (e) => {
  const tarefa = JSON.parse(e.data);
  atualizarEcra(tarefa);
});
```

E faz duas coisas sozinho que justificam usá-lo: **volta a ligar** quando a ligação cai, e, quando volta, envia o cabeçalho **`Last-Event-ID`** com o id do último evento que recebeu. Se o servidor guardar os eventos recentes, reenvia o que o cliente perdeu durante a queda (o P1).

Vantagens: é HTTP, por isso passa pelos proxies, usa os mesmos cookies e a mesma autenticação, funciona com HTTP/2 (muitos streams numa só ligação) e é simples de depurar (`curl -N http://.../eventos`). Limitação: só do servidor para o cliente. Para o cliente falar com o servidor, usa pedidos HTTP normais, o que, na maior parte das aplicações, chega perfeitamente.

As respostas em streaming dos LLMs (o módulo de LLMs, secção 4) usam exatamente este formato.

## 3. WebSockets

Um WebSocket começa como um pedido HTTP com um pedido de mudança de protocolo:

```
GET /chat HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...

HTTP/1.1 101 Switching Protocols
```

A partir daí, a ligação TCP deixa de falar HTTP: os dois lados enviam **mensagens** (texto ou binário) quando quiserem, nos dois sentidos, sem cabeçalhos por mensagem. No browser (e no Node 22, que tem a mesma classe):

```js
const ws = new WebSocket('wss://exemplo.pt/chat');   // wss: WebSocket sobre TLS
ws.addEventListener('open', () => ws.send(JSON.stringify({ tipo: 'entrar', sala: 'geral' })));
ws.addEventListener('message', (e) => mostrar(JSON.parse(e.data)));
ws.addEventListener('close', () => /* voltar a ligar (P4) */ {});
```

No servidor Node, a biblioteca mais usada é a **ws** (o P3). O **Socket.IO** é uma camada por cima, com salas, reconexão e alternativas para quando os WebSockets não passam, mas usa um protocolo próprio: um cliente WebSocket normal não fala com um servidor Socket.IO.

O WebSocket não tem a estrutura que o HTTP te dá: não há rotas, códigos de estado, nem tipos de mensagem. Tens de desenhar o teu **protocolo**: mensagens JSON com um campo `tipo`, validação de cada mensagem (é input do utilizador, como tudo: módulo 26), e respostas de erro.

## 4. Os problemas de produção

**Ligações mortas.** Quando um portátil fecha a tampa ou o Wi-Fi cai, a ligação TCP não é fechada: o servidor continua a achar que o cliente está lá, e acumula sockets mortos. A solução é um **batimento** (*heartbeat*): o servidor envia um ping a cada N segundos e termina quem não respondeu ao anterior (o P3). No SSE, um comentário periódico (`: ping`) faz o mesmo papel, e ainda evita que os proxies fechem a ligação por inatividade.

**Quedas e reconexão.** As ligações caem sempre: deploys, redes móveis, balanceadores que reiniciam. O cliente tem de voltar a ligar sozinho, com **backoff exponencial e jitter** (como no módulo 05 e no P4 do módulo 24): se mil clientes caírem ao mesmo tempo e voltarem todos no mesmo instante, derrubam o servidor que acabou de arrancar. E, ao voltar, tem de repor o estado: voltar a entrar nas salas, reenviar o que ficou por enviar, e pedir o que perdeu (o `Last-Event-ID` do SSE).

**Proxies e balanceadores.** O Nginx (módulo 10) precisa de configuração para cada um:

```nginx
location /api/eventos {                 # SSE
  proxy_pass http://api;
  proxy_buffering off;                  # sem isto, o Nginx guarda os eventos e envia-os aos montes
  proxy_read_timeout 1h;
}
location /chat {                        # WebSockets
  proxy_pass http://api;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 1h;
}
```

**Várias réplicas.** Com duas réplicas da API, a Ana está ligada à réplica 1 e o Bruno à réplica 2. Quando a Ana envia uma mensagem para a sala, a réplica 1 só a consegue entregar aos clientes **dela**. É preciso um canal entre réplicas: o **pub/sub do Redis** (módulo 05) é o mais comum, e cada réplica publica lá as mensagens e entrega as que recebe aos seus clientes. O RabbitMQ (módulo 06) com um *exchange fanout* faz o mesmo.

**Autenticação.** O `EventSource` envia os cookies, mas não deixa pôr cabeçalhos (`Authorization`). O `WebSocket` do browser também não. As opções: cookies de sessão (módulo 26), um token de curta duração no URL (`?ticket=...`, gerado por um pedido HTTP autenticado e válido por segundos), ou uma primeira mensagem de autenticação.

**Memória.** Cada ligação aberta ocupa memória no servidor. Dez mil utilizadores ligados são dez mil sockets. O Node lida bem com muitas ligações paradas (é o *event loop* do módulo 01), mas mede antes de prometer números.

## Em resumo

- O HTTP só responde a quem pergunta; para o servidor **empurrar** dados há o polling, os **Server-Sent Events** e os **WebSockets**.
- O **SSE** é um fluxo de texto do servidor para o cliente sobre HTTP normal, com reconexão automática e retoma pelo último id: chega para notificações e painéis.
- Os **WebSockets** são um canal bidirecional persistente: para chat, colaboração e jogos.
- Em produção, as ligações **morrem sem avisar** (*heartbeats*), **caem** (reconexão com *backoff* e retoma), precisam de configuração nos proxies, e com **várias réplicas** é preciso um canal comum (Redis Pub/Sub, RabbitMQ) para difundir.
- A autenticação e a memória por ligação também mudam: cada ligação aberta custa recursos no servidor.

---

## Prática: escreve tu

Os dois lados do SSE (o servidor que difunde eventos e se lembra dos recentes, e um cliente que lê o stream à mão), um chat com salas sobre WebSockets com batimento, e um cliente WebSocket que sobrevive a quedas. Os testes usam servidores HTTP reais em portas locais, o `WebSocket` do Node (o mesmo do browser), e, no P3, um cliente que deixa de responder aos pings, para simular uma ligação morta.

**Ficheiros:** `pratica/45-tempo-real/` (`sse.js`, `clienteSse.js`, `chat.js`, `clienteResiliente.js`)

**Verificar:** `npm run verificar 45` (dentro de `pratica/`). Só um exercício: `npm run verificar 45 sse`, `... 45 clienteSse`, `... 45 chat` ou `... 45 clienteResiliente`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Um difusor de SSE (≈30 min)

**Ficheiro:** `sse.js`

Formatar eventos no protocolo SSE, e um difusor que mantém os clientes ligados, lhes envia os eventos publicados, guarda os últimos para quem volta com `Last-Event-ID`, envia um batimento, e esquece quem se desliga.

**Sintaxe que vais praticar:** `res.writeHead` com cabeçalhos, `res.write` sem `res.end`, um `Set` de respostas, `req.on('close')`, `setInterval`/`clearInterval`, um histórico com tamanho máximo.

<details>
<summary>Pista</summary>

O segredo do SSE é **nunca** chamar `res.end()`: a resposta fica aberta, e cada `res.write` chega ao cliente como mais um bocado. Guarda as respostas abertas num `Set`; o `publicar` percorre-o. No `close` do pedido, tira-a do `Set` e para o batimento dessa ligação.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function formatarEvento({ evento, dados, id }) {
  let texto = '';
  if (id !== undefined) texto += `id: ${id}\n`;
  if (evento !== undefined) texto += `event: ${evento}\n`;
  const corpo = typeof dados === 'string' ? dados : JSON.stringify(dados);
  // Uma quebra de linha nos dados terminaria o campo: cada linha vai no seu "data:".
  for (const linha of corpo.split('\n')) texto += `data: ${linha}\n`;
  return `${texto}\n`;
}

export class Difusor {
  constructor({ guardar = 50, batimentoMs = 15000 } = {}) {
    this.guardar = guardar;
    this.batimentoMs = batimentoMs;
    this.ligados = new Set();
    this.historico = [];
    this.ultimoId = 0;
  }

  get clientes() {
    return this.ligados.size;
  }

  ligar(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Quem volta a ligar diz qual foi o último evento que viu; reenviamos o que perdeu.
    const desde = Number(req.headers['last-event-id']);
    if (Number.isFinite(desde)) {
      for (const e of this.historico) if (e.id > desde) res.write(formatarEvento(e));
    }
    this.ligados.add(res);
    const batimento = setInterval(() => res.write(': ping\n\n'), this.batimentoMs);
    req.on('close', () => {
      clearInterval(batimento);
      this.ligados.delete(res);
    });
  }

  publicar(evento, dados) {
    const e = { id: ++this.ultimoId, evento, dados };
    this.historico.push(e);
    if (this.historico.length > this.guardar) this.historico.shift();
    const texto = formatarEvento(e);
    for (const res of this.ligados) res.write(texto);
  }
}
```
</details>

### P2 · Ler um stream SSE (≈30 min)

**Ficheiro:** `clienteSse.js`

O que o `EventSource` faz por ti: ler o corpo aos bocados, juntar as linhas (que podem vir partidas a meio entre dois bocados), e montar os eventos. O servidor dos testes parte o stream nos sítios piores, de propósito.

**Sintaxe que vais praticar:** `for await` sobre `resposta.body`, `TextDecoder` com `{ stream: true }`, `split('\n')` e `pop()` para guardar a linha incompleta, um *parser* com estado.

<details>
<summary>Pista</summary>

Guarda numa variável o texto que ainda não formou uma linha completa. Em cada bocado novo: junta-o a esse texto, parte por `\n`, e a **última** parte (que pode estar incompleta) volta a ficar guardada para o bocado seguinte. As outras são linhas completas, que processas uma a uma.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function lerEventos(url, aoEvento, { signal, ultimoId } = {}) {
  const resposta = await fetch(url, {
    headers: { Accept: 'text/event-stream', ...(ultimoId !== undefined && { 'Last-Event-ID': String(ultimoId) }) },
    signal,
  });
  const decoder = new TextDecoder();
  let pendente = ''; // o que chegou mas ainda não formou uma linha completa
  let evento = 'message';
  let dados = [];
  let id;

  const linha = (l) => {
    if (l === '') {
      // Linha em branco: fim do evento. Sem dados, não há evento para entregar.
      if (dados.length) aoEvento({ evento, dados: dados.join('\n'), id });
      evento = 'message';
      dados = [];
      return;
    }
    if (l.startsWith(':')) return; // comentário (ex.: o batimento)
    const i = l.indexOf(':');
    const campo = i === -1 ? l : l.slice(0, i);
    let valor = i === -1 ? '' : l.slice(i + 1);
    if (valor.startsWith(' ')) valor = valor.slice(1);
    if (campo === 'event') evento = valor;
    else if (campo === 'data') dados.push(valor);
    else if (campo === 'id') id = valor; // o id fica: vale também para os eventos seguintes
  };

  for await (const bocado of resposta.body) {
    pendente += decoder.decode(bocado, { stream: true });
    const linhas = pendente.split('\n');
    pendente = linhas.pop(); // a última pode estar incompleta: fica à espera do próximo bocado
    for (const l of linhas) linha(l.replace(/\r$/, ''));
  }
}
```
</details>

### P3 · Um chat com salas (≈40 min)

**Ficheiro:** `chat.js`

Um servidor de WebSockets com um pequeno protocolo: entrar numa sala, enviar mensagens à sala, erros para o próprio cliente, aviso quando alguém sai, e um batimento que termina as ligações mortas.

**Sintaxe que vais praticar:** `new WebSocketServer({ server })`, os eventos `connection`/`message`/`close`/`pong`, `ws.send`, `ws.ping`, `ws.terminate`, um `Map` de salas para `Set`s de sockets, propriedades próprias guardadas no socket (`ws.sala`, `ws.vivo`).

<details>
<summary>Pista</summary>

Para o batimento: quando um cliente liga, `ws.vivo = true`, e cada `pong` volta a pô-lo a `true`. A cada intervalo, percorre os clientes: quem estiver com `vivo === false` não respondeu ao ping anterior, e é terminado; aos outros, põe `vivo = false` e envia um `ping` novo. O `terminate` dispara o `close`, que já trata da sala.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { WebSocketServer } from 'ws';

export function criarChat({ server, batimentoMs = 30000 }) {
  const wss = new WebSocketServer({ server });
  const salas = new Map(); // nome da sala → Set de sockets

  const enviar = (ws, obj) => ws.send(JSON.stringify(obj));
  const difundir = (sala, obj) => {
    for (const ws of salas.get(sala) ?? []) enviar(ws, obj);
  };
  const sair = (ws) => {
    const membros = salas.get(ws.sala);
    if (!membros) return;
    membros.delete(ws);
    if (membros.size === 0) salas.delete(ws.sala);
  };

  wss.on('connection', (ws) => {
    ws.vivo = true;
    ws.on('pong', () => {
      ws.vivo = true;
    });

    ws.on('message', (bruto) => {
      let m;
      try {
        m = JSON.parse(bruto);
      } catch {
        return enviar(ws, { tipo: 'erro', motivo: 'json' });
      }
      if (m.tipo === 'entrar') {
        sair(ws);
        ws.sala = m.sala;
        ws.nome = m.nome;
        if (!salas.has(m.sala)) salas.set(m.sala, new Set());
        salas.get(m.sala).add(ws);
        return difundir(m.sala, { tipo: 'entrou', nome: m.nome });
      }
      if (m.tipo === 'mensagem') {
        if (!ws.sala) return enviar(ws, { tipo: 'erro', motivo: 'sem-sala' });
        if (typeof m.texto !== 'string' || m.texto.length < 1 || m.texto.length > 500) {
          return enviar(ws, { tipo: 'erro', motivo: 'texto' });
        }
        return difundir(ws.sala, { tipo: 'mensagem', nome: ws.nome, texto: m.texto });
      }
      enviar(ws, { tipo: 'erro', motivo: 'tipo' });
    });

    ws.on('close', () => {
      const sala = ws.sala;
      sair(ws);
      if (sala) difundir(sala, { tipo: 'saiu', nome: ws.nome });
    });
  });

  // Se um cliente não respondeu ao ping anterior, a ligação está morta (mesmo sem nunca ter fechado).
  const batimento = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) {
        ws.terminate(); // dispara o 'close', que trata da sala
        continue;
      }
      ws.vivo = false;
      ws.ping();
    }
  }, batimentoMs);

  return {
    wss,
    salas: () => Object.fromEntries([...salas].map(([nome, membros]) => [nome, membros.size])),
    fechar: () => {
      clearInterval(batimento);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
```
</details>

### P4 · Um cliente que sobrevive a quedas (≈30 min)

**Ficheiro:** `clienteResiliente.js`

O backoff exponencial com jitter, e um cliente WebSocket que volta a ligar sozinho, repõe o estado (`aoLigar`), guarda numa fila o que é enviado durante a queda, e para de vez quando lhe pedem.

**Sintaxe que vais praticar:** o `WebSocket` do browser (`addEventListener`, `readyState`, `WebSocket.OPEN`), `setTimeout` guardado para poder ser cancelado, `splice(0)` para esvaziar uma fila, um `getter`.

<details>
<summary>Pista</summary>

Põe a criação do socket num método `ligar()`, que o `close` volta a chamar (através de um `setTimeout` com a espera). Usa uma variável `fechado` para distinguir "a ligação caiu" de "o utilizador fechou": sem ela, o `fechar()` voltaria a ligar.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function esperaAntesDe(tentativa, { base = 500, maximo = 10000, aleatorio = Math.random } = {}) {
  const teto = Math.min(maximo, base * 2 ** tentativa);
  return Math.round(aleatorio() * teto);
}

export class ClienteResiliente {
  constructor(url, { aoMensagem, aoLigar = () => {}, espera = esperaAntesDe }) {
    Object.assign(this, { url, aoMensagem, aoLigar, espera });
    this.fila = [];
    this.tentativa = 0;
    this.fechado = false;
    this.ligar();
  }

  get ligado() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  ligar() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.tentativa = 0;
      this.aoLigar(this);
      // O que ficou na fila durante a queda segue agora, pela ordem.
      for (const texto of this.fila.splice(0)) ws.send(texto);
    });
    ws.addEventListener('message', (e) => this.aoMensagem(JSON.parse(e.data)));
    ws.addEventListener('close', () => {
      if (this.fechado) return;
      this.relogio = setTimeout(() => this.ligar(), this.espera(this.tentativa++));
    });
    ws.addEventListener('error', () => {}); // o 'close' vem a seguir e trata de voltar a ligar
  }

  enviar(objeto) {
    const texto = JSON.stringify(objeto);
    if (this.ligado) this.ws.send(texto);
    else this.fila.push(texto);
  }

  fechar() {
    this.fechado = true;
    clearTimeout(this.relogio);
    this.ws?.close();
  }
}
```
</details>

## Experiências

1. **SSE no terminal:** arranca um servidor com o teu `Difusor` numa porta (um `.mjs` com `http.createServer((req, res) => d.ligar(req, res)).listen(3400)` e um `setInterval(() => d.publicar('hora', new Date().toISOString()), 1000)`), e corre `curl -N http://localhost:3400`. O `-N` desliga o buffer do curl. Para o servidor, volta a arrancá-lo, e liga com `curl -N -H "Last-Event-ID: 3" ...`.
2. **No browser:** com esse servidor, abre a consola de qualquer página em `http://localhost:3400` e escreve `new EventSource('/').onmessage = (e) => console.log(e.data)`. Para e arranca o servidor: o `EventSource` volta a ligar sozinho. No separador "Network" das ferramentas do browser, vês o pedido a receber eventos.
3. **Duas réplicas:** arranca o teu chat em duas portas, com um cliente em cada uma, na mesma sala. As mensagens não passam de um lado para o outro. Liga as duas réplicas pelo pub/sub do Redis (`PUBLISH sala:geral ...` e `SUBSCRIBE`), com o Redis do workshop.
4. **O Nginx a guardar os eventos:** põe o servidor da experiência 1 atrás de um Nginx (módulo 10) sem `proxy_buffering off` e repara no atraso com que os eventos chegam ao `curl`.

## Perguntas de pensamento crítico

1. Uma aplicação de gestão de tarefas quer avisar o utilizador quando uma tarefa é concluída por outro membro da equipa. SSE, WebSockets ou polling?
2. Porque é que um cliente que volta a ligar deve esperar um tempo aleatório, e não sempre o mesmo?
3. Tens 3 réplicas da API atrás de um balanceador, e um chat com WebSockets. O que tens de acrescentar para funcionar, e porquê?

<details>
<summary>Respostas</summary>

1. SSE: as notificações só vão do servidor para o cliente, e as ações do utilizador já são pedidos HTTP normais. É HTTP (passa pelos proxies, usa a mesma autenticação), o browser trata da reconexão, e o `Last-Event-ID` recupera o que se perdeu. WebSockets seriam complexidade sem benefício; polling seria mais simples, mas com atraso e muitos pedidos inúteis (aceitável num protótipo).
2. Porque as quedas costumam ser coletivas (um deploy, um balanceador que reinicia, uma falha de rede): milhares de clientes caem no mesmo segundo. Com uma espera fixa, voltam todos no mesmo instante e derrubam o servidor que acabou de arrancar, que cai outra vez, e assim por diante. Com jitter, as reconexões espalham-se pelo intervalo.
3. Um canal entre as réplicas (o pub/sub do Redis, ou o RabbitMQ com um exchange fanout): cada réplica só conhece os clientes ligados a si, por isso uma mensagem tem de ser publicada no canal e entregue por cada réplica aos seus clientes daquela sala. E, no balanceador e no proxy, a configuração de WebSockets (`Upgrade`, timeouts longos); afinidade de sessão (*sticky sessions*) só é necessária se houver estado da ligação guardado em memória.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 45`.

**1.** Para notificações que só vão do servidor para o browser, qual é normalmente a escolha mais simples?

- a) WebSockets
- b) Server-Sent Events (SSE)
- c) Polling a cada 100 ms
- d) Um email

<details><summary>Resposta</summary>

**b) Server-Sent Events (SSE)** — É HTTP, passa pelos proxies, usa a mesma autenticação, e o EventSource volta a ligar sozinho.

</details>

**2.** Que cabeçalho envia o EventSource ao voltar a ligar, para o servidor reenviar o que se perdeu?

<details><summary>Resposta</summary>

**last-event-id** — Com os eventos recentes guardados, o servidor envia os que têm id maior do que esse.

</details>

**3.** Para que serve o batimento (ping/pong) num servidor de WebSockets?

- a) Para medir a velocidade da rede
- b) Para detetar e terminar ligações mortas que nunca chegaram a fechar (portátil fechado, Wi-Fi que caiu)
- c) Para cifrar as mensagens
- d) Para o browser saber a hora

<details><summary>Resposta</summary>

**b) Para detetar e terminar ligações mortas que nunca chegaram a fechar (portátil fechado, Wi-Fi que caiu)** — Sem ele, o servidor acumula sockets mortos; e os proxies fecham ligações paradas.

</details>

**4.** Com 3 réplicas de uma API com WebSockets, porque é que uma mensagem de chat não chega a todos?

- a) Porque os WebSockets não suportam várias réplicas
- b) Porque cada réplica só conhece os clientes ligados a si; é preciso um canal entre réplicas (ex.: pub/sub do Redis)
- c) Porque o balanceador apaga mensagens
- d) Porque o JSON é grande demais

<details><summary>Resposta</summary>

**b) Porque cada réplica só conhece os clientes ligados a si; é preciso um canal entre réplicas (ex.: pub/sub do Redis)** — Cada réplica publica no canal e entrega o que recebe aos seus próprios clientes.

</details>

**5.** Porque é que um cliente que volta a ligar usa backoff exponencial com jitter?

- a) Para gastar menos bateria
- b) Para não sobrecarregar o servidor: sem espera crescente e aleatória, milhares de clientes voltam todos no mesmo instante
- c) Porque o protocolo obriga
- d) Para as mensagens chegarem por ordem

<details><summary>Resposta</summary>

**b) Para não sobrecarregar o servidor: sem espera crescente e aleatória, milhares de clientes voltam todos no mesmo instante** — As quedas costumam ser coletivas; o aleatório espalha as reconexões.

</details>

<!-- quiz:end -->
