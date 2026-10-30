# 25 · Redes: do URL ao byte

**Objetivo:** perceber o que acontece entre o `fetch('https://...')` e a resposta: endereços IP e redes, TCP e UDP, DNS, HTTP por dentro e TLS. São as camadas que usaste em todos os módulos sem as ver, e que aparecem sempre que algo "não liga".

**Ficheiros para ler:** `config/docker-compose.yml` (as redes e portas), `src/web/nginx.conf` (o proxy do módulo 10).

**Pré-requisitos:** módulos 01 (HTTP), 10 (Nginx) e 24 (terminal).

---

## 1. "O que acontece quando escreves um URL no browser?"

É talvez a pergunta de entrevista mais famosa, porque passa por todas as camadas. Para `https://notas.exemplo.pt/api/tasks`:

1. **DNS:** o browser precisa do IP de `notas.exemplo.pt`. Pergunta à cache dele, à do sistema, e depois a um resolvedor (o do teu router ou do teu fornecedor), que, se não souber, pergunta aos servidores raiz, depois aos do `.pt`, e depois aos do `exemplo.pt`. Resposta: `203.0.113.7`.
2. **TCP:** abre uma ligação a `203.0.113.7`, porta 443, com o *three-way handshake* (SYN, SYN-ACK, ACK).
3. **TLS:** negoceia a cifra, recebe o certificado do servidor, verifica que é válido e que é de `notas.exemplo.pt`, e combina as chaves da sessão.
4. **HTTP:** envia `GET /api/tasks` com os cabeçalhos (e o token de autenticação, já cifrado pelo TLS).
5. **Do outro lado:** um balanceador ou um Nginx (módulo 10) recebe, encaminha para a API, que fala com o Postgres e o Redis, e responde.
6. **De volta:** a resposta viaja pelo mesmo caminho; o browser processa-a, e a ligação fica aberta para os pedidos seguintes (*keep-alive*).

Cada passo pode falhar, e cada falha tem uma cara diferente: `ERR_NAME_NOT_RESOLVED` é o DNS; `ECONNREFUSED` é o TCP (ninguém a ouvir na porta); `ETIMEDOUT` é o TCP (uma firewall a deitar fora os pacotes); `CERT_HAS_EXPIRED` é o TLS; um `502` é o HTTP (o proxy não conseguiu falar com a app). Saber em que camada está o problema é metade do diagnóstico.

## 2. As camadas

| Camada (modelo TCP/IP) | O que faz | Exemplos |
|---|---|---|
| Aplicação | o significado das mensagens | HTTP, DNS, TLS, MQTT, SSH, o protocolo do Postgres |
| Transporte | entregar a um **processo** (porta), com ou sem garantias | TCP, UDP (e o QUIC, sobre UDP) |
| Rede | entregar a uma **máquina** (IP), através de vários routers | IPv4, IPv6 |
| Ligação | entregar ao vizinho do lado | Ethernet, Wi-Fi |

Vais ouvir falar do **modelo OSI**, com 7 camadas. Na prática, o vocabulário que sobrevive dele é "camada 4" (transporte: um balanceador que só vê IPs e portas) e "camada 7" (aplicação: um proxy que lê o HTTP e decide pelo caminho ou pelos cabeçalhos, como o Nginx do módulo 10).

## 3. Endereços IP, redes e NAT

Um IPv4 são 32 bits, escritos como quatro números de 0 a 255. Uma **rede** escreve-se em notação **CIDR**: `192.168.1.0/24` são todos os endereços cujos primeiros 24 bits coincidem, ou seja, de `192.168.1.0` a `192.168.1.255` (256 endereços). Quanto maior o prefixo, mais pequena a rede: um `/16` tem 65 536, um `/32` é um único endereço, e um `/0` é a Internet inteira.

Há redes reservadas que nunca aparecem na Internet pública (o P4 do módulo 26 bloqueava-as):

| Rede | Para quê |
|---|---|
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | redes privadas (casa, empresas, VPCs na cloud, redes do Docker) |
| `127.0.0.0/8` | a própria máquina (*loopback*) |
| `169.254.0.0/16` | *link-local* (e o serviço de metadados da cloud) |

Como é que dez aparelhos em tua casa, todos com `192.168.1.x`, saem para a Internet com um único IP público? Por **NAT**: o router troca o endereço de origem de cada pacote pelo seu, e lembra-se de quem pediu o quê para entregar as respostas. É também o que o Docker faz quando publicas uma porta (`-p 127.0.0.1:3100:3000`, módulo 02): uma regra de NAT entre a porta do teu portátil e o IP do contentor.

O **IPv6** (128 bits, `2001:db8::1`) resolve a falta de endereços IPv4 e dispensa o NAT. Já é a maioria do tráfego em muitas redes móveis. O `::1` é o *loopback*.

## 4. TCP e UDP

| | **TCP** | **UDP** |
|---|---|---|
| Ligação | sim: *handshake* de 3 passos antes de enviar dados | não: envia logo |
| Garantias | entrega por ordem, sem perdas, sem duplicados (reenvia o que se perdeu) | nenhuma: um pacote pode perder-se, chegar duas vezes ou fora de ordem |
| Unidade | um *stream* de bytes contínuo | mensagens (datagramas) independentes |
| Custo | mais lento a começar e mais pesado | rápido e leve |
| Usado por | HTTP/1.1 e 2, bases de dados, SSH, MQTT | DNS, vídeo e voz em tempo real, jogos, QUIC (HTTP/3) |

Duas consequências do "stream de bytes" do TCP que apanham toda a gente:

- **Não há mensagens:** se escreveres "olá" e depois "mundo", o outro lado pode receber "olámun" e depois "do". É por isso que o corpo de um pedido HTTP chega aos bocados (o `for await (const chunk of req)` do módulo 01), e é por isso que o HTTP precisa do `Content-Length` ou do `chunked` para saber onde acaba a resposta.
- **O *handshake* custa uma ida e volta.** De Lisboa a um servidor nos EUA são cerca de 100 ms; com o TLS por cima, mais uma ou duas. É por isso que se reutilizam ligações (*keep-alive*, *pools* de ligações à BD) e se põem servidores perto dos utilizadores (CDN).

Uma **porta** identifica o processo dentro da máquina: o Postgres na 5432, o HTTPS na 443. Abaixo de 1024 são portas "de sistema", que só o root pode ocupar (é por isso que os contentores costumam usar a 3000 ou a 8080).

## 5. DNS

O DNS traduz nomes em registos. É uma base de dados distribuída e hierárquica, e quase toda a gente só a percebe no dia em que falha.

| Registo | Para quê |
|---|---|
| `A` / `AAAA` | nome → IPv4 / IPv6 |
| `CNAME` | nome → outro nome ("é um alias de") |
| `MX` | servidores de email do domínio |
| `TXT` | texto livre: verificação de domínios, SPF e DKIM (anti-spam) |
| `NS` | que servidores respondem por este domínio |

Cada resposta tem um **TTL** (*time to live*): quantos segundos pode ficar em cache. Um TTL de 1 hora quer dizer que, se mudares o IP, há quem continue a ir ao antigo durante até uma hora. Antes de uma migração, baixa-se o TTL com antecedência.

O DNS usa **UDP** na porta 53: uma pergunta, uma resposta, sem ligação. Cada mensagem tem um **id** de 16 bits, e quem pergunta só aceita respostas com o mesmo id. É uma defesa (fraca) contra respostas forjadas, e o P2 obriga-te a respeitá-la. A mensagem é binária e compacta: os nomes repetidos são **comprimidos** com ponteiros para onde já apareceram no pacote.

```bash
dig notas.exemplo.pt              # a resposta completa, com TTL e o servidor que respondeu
dig +short notas.exemplo.pt A     # só o IP
dig @1.1.1.1 exemplo.pt MX        # perguntar a um servidor específico
dig +trace exemplo.pt             # o caminho todo, a partir dos servidores raiz
```

Dentro do Docker Compose, há um DNS interno: o nome do serviço (`redis`, `postgres`) resolve para o IP do contentor. Foi a razão do bug do Nginx do módulo 10: ele resolvia `api` uma vez, no arranque, e ficava com o IP antigo quando o contentor era recriado.

## 6. HTTP por dentro

Por cima do TCP, o HTTP/1.1 é **texto**:

```
GET /api/tasks HTTP/1.1
Host: notas.exemplo.pt
Authorization: Bearer eyJhbGciOi...
Accept: application/json

```

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 27

[{"id":1,"title":"Pão"}]
```

Uma linha de pedido (ou de estado), cabeçalhos, uma **linha em branco**, e o corpo. Cada linha termina em `\r\n`. O `Host` é obrigatório, porque o mesmo IP serve muitos sites. O fim do corpo é marcado pelo `Content-Length` (em **bytes**: "ação" são 4 caracteres e 6 bytes em UTF-8), ou pelo `Transfer-Encoding: chunked`, quando o servidor não sabe o tamanho à partida e envia pedaços, cada um precedido do seu tamanho em hexadecimal, até um pedaço de tamanho 0.

As versões seguintes mudam o transporte, não o significado:

| Versão | O que mudou |
|---|---|
| HTTP/1.1 | texto; um pedido de cada vez por ligação |
| HTTP/2 | binário; vários pedidos em paralelo na mesma ligação, cabeçalhos comprimidos |
| HTTP/3 | sobre **QUIC** (UDP): sem o bloqueio do TCP quando um pacote se perde, e com o *handshake* de transporte e de TLS juntos |

```bash
curl -v https://exemplo.pt/       # mostra o DNS, a ligação, o TLS, os cabeçalhos enviados (>) e recebidos (<)
curl -sI https://exemplo.pt/      # só os cabeçalhos da resposta
```

## 7. TLS e certificados

O **TLS** (o "S" do HTTPS) dá três garantias: **confidencialidade** (ninguém lê), **integridade** (ninguém altera sem se notar) e **autenticação** (estás mesmo a falar com `notas.exemplo.pt`).

A autenticação vem do **certificado**: um documento com o nome do site e uma chave pública, assinado por uma **autoridade de certificação** (CA) em quem o teu sistema já confia (há uma lista delas instalada no sistema operativo e no browser). O browser verifica:

1. que a assinatura é de uma CA de confiança (ou de uma cadeia que lá chega);
2. que o certificado não expirou;
3. que o nome pedido está na lista de nomes do certificado (o *Subject Alternative Name*).

Um certificado **autoassinado** (o emissor é o próprio) não passa no ponto 1. Serve para testes e redes internas, se disseres explicitamente ao cliente para confiar nele, como faz o terceiro teste do P4.

O **SNI** (*Server Name Indication*) é o nome que o cliente diz querer **antes** de a cifra começar, para que um servidor com muitos sites no mesmo IP saiba que certificado mostrar. O **Let's Encrypt** emite certificados de graça, válidos 90 dias, renovados automaticamente. A causa número um de "o site foi abaixo" com certificados é uma renovação que falhou em silêncio: monitoriza a data de expiração (o módulo 19 tem as ferramentas).

```bash
openssl s_client -connect exemplo.pt:443 -servername exemplo.pt </dev/null | openssl x509 -noout -subject -issuer -dates
```

## 8. Ferramentas de diagnóstico

| Pergunta | Ferramenta |
|---|---|
| O nome resolve? Para quê? | `dig`, `nslookup`, `getent hosts nome` (usa a mesma configuração que os programas) |
| A máquina responde? | `ping` (ICMP: muitas firewalls bloqueiam-no, por isso "não responde" não prova nada) |
| Por onde passam os pacotes? | `traceroute`, `mtr` |
| A porta está aberta? | `nc -zv host 5432`, ou `curl -v telnet://host:5432` |
| Quem está a ouvir nesta máquina? | `ss -tlnp` (módulo 24) |
| O que vai e vem de facto? | `tcpdump -i any port 53`, ou o Wireshark |
| O HTTP e o TLS estão bem? | `curl -v`, `openssl s_client` |

E os números de latência que vale a pena ter na cabeça (ordens de grandeza):

| Operação | Tempo |
|---|---|
| ler da memória | 100 ns |
| ler 1 MB de um SSD | 50 µs a 1 ms |
| uma ida e volta na mesma zona de uma cloud | 0,5 ms |
| uma ida e volta Lisboa–Frankfurt | 30 ms |
| uma ida e volta Lisboa–Califórnia | 150 ms |

Uma API que faz 10 pedidos **em série** a um serviço noutro continente demora pelo menos 1,5 segundos, por mais rápido que seja o código.

---

## Prática: escreve tu

Quatro exercícios que te põem dentro das camadas: contas com IPs e redes, uma mensagem DNS construída e lida byte a byte (e enviada por UDP), um cliente HTTP/1.1 escrito sobre uma ligação TCP crua, e a leitura de um certificado TLS. Os testes usam servidores locais (um DNS falso, um servidor HTTP do Node, e um servidor TLS com um certificado gerado pelo `openssl` em cada execução), por isso não precisas de Internet.

**Ficheiros:** `pratica/25-redes/` (`ip.js`, `dns.js`, `httpCru.js`, `tls.js`)

**Verificar:** `npm run verificar 25` (dentro de `pratica/`). Só um exercício: `npm run verificar 25 ip`, `... 25 dns`, `... 25 http` ou `... 25 tls`. O do TLS precisa do `openssl` (vem com quase todos os Linux e macOS).

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · IPs e redes CIDR (≈20 min)

**Ficheiro:** `ip.js`

Converter IPs em números de 32 bits e de volta, e responder às perguntas que fazes ao configurar uma firewall, uma VPC ou o bloqueio de SSRF: este IP está nesta rede? Onde começa e acaba a rede?

**Sintaxe que vais praticar:** `split`, `reduce`, regex com âncoras, `Number.isInteger`, `**` e `Math.floor` em vez dos operadores de bits.

<details>
<summary>Pista</summary>

Em JavaScript, os operadores de bits (`<<`, `&`, `|`) convertem os números para inteiros de 32 bits **com sinal**: `255 << 24` dá um número negativo. Com multiplicações e `Math.floor` não tens esse problema. O início de uma rede `/p` é o IP arredondado para baixo para um múltiplo de `2 ** (32 - p)`.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function ipParaNumero(ip) {
  const partes = String(ip).split('.');
  // Só dígitos, sem zeros à esquerda ("01" é ambíguo: há sistemas que o leem como octal).
  if (partes.length !== 4 || !partes.every((p) => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255)) {
    throw new Error(`IP inválido: "${ip}"`);
  }
  // Multiplicar em vez de << 24: em JavaScript, os operadores de bits trabalham com inteiros de
  // 32 bits COM sinal, e 255 << 24 daria um número negativo.
  return partes.reduce((total, p) => total * 256 + Number(p), 0);
}

export function numeroParaIp(n) {
  return [24, 16, 8, 0].map((desloca) => Math.floor(n / 2 ** desloca) % 256).join('.');
}

// O tamanho de um bloco /prefixo: 2^(32 - prefixo) endereços.
const tamanho = (prefixo) => 2 ** (32 - prefixo);

function lerCidr(cidr) {
  const [ip, p] = String(cidr).split('/');
  const prefixo = Number(p);
  if (!Number.isInteger(prefixo) || prefixo < 0 || prefixo > 32) throw new Error(`prefixo inválido: "${cidr}"`);
  const bloco = tamanho(prefixo);
  // O início da rede: arredonda o IP para baixo, para um múltiplo do tamanho do bloco.
  const rede = Math.floor(ipParaNumero(ip) / bloco) * bloco;
  return { rede, bloco };
}

export function naRede(ip, cidr) {
  const { rede, bloco } = lerCidr(cidr);
  const n = ipParaNumero(ip);
  return n >= rede && n < rede + bloco;
}

export function intervalo(cidr) {
  const { rede, bloco } = lerCidr(cidr);
  return { rede: numeroParaIp(rede), broadcast: numeroParaIp(rede + bloco - 1), total: bloco };
}
```
</details>

### P2 · Uma pergunta DNS, à mão (≈45 min)

**Ficheiro:** `dns.js`

Construir os bytes de uma pergunta do tipo A, ler uma resposta (com a compressão de nomes), e enviá-la por UDP a um servidor, ignorando as respostas cujo id não é o teu. Os testes comparam os teus bytes com os de uma pergunta real.

**Sintaxe que vais praticar:** `Buffer.alloc`, `writeUInt16BE`/`readUInt16BE`/`readUInt32BE`, `Buffer.concat`, `subarray`, operações de bits (`& 0xc0`, `& 0x3fff`), `node:dgram`, `setTimeout` como prazo numa `Promise`, `.finally`.

<details>
<summary>Pista</summary>

Escreve o `lerNome` com um ciclo e uma variável `fim` que só é definida **uma vez**: no primeiro ponteiro, ou no 0 final se não houver ponteiros. Depois de saltar para um ponteiro, continuas a ler noutro sítio do pacote, mas o nome original acabou ali. No `perguntar`, o `socket.on('message')` pode ser chamado várias vezes: resolve só quando o id bater certo.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { randomInt } from 'node:crypto';
import dgram from 'node:dgram';

export function construirPergunta(id, nome) {
  const cabecalho = Buffer.alloc(12);
  cabecalho.writeUInt16BE(id, 0);
  cabecalho.writeUInt16BE(0x0100, 2); // recursion desired: "resolve tu, até ao fim"
  cabecalho.writeUInt16BE(1, 4);      // uma pergunta
  // (os outros três contadores ficam a 0: o Buffer.alloc já vem preenchido com zeros)

  const labels = nome
    .replace(/\.$/, '')
    .split('.')
    .map((parte) => {
      const bytes = Buffer.from(parte, 'ascii');
      return Buffer.concat([Buffer.from([bytes.length]), bytes]);
    });
  const tipoEClasse = Buffer.from([0, 1, 0, 1]); // tipo A, classe IN
  return Buffer.concat([cabecalho, ...labels, Buffer.from([0]), tipoEClasse]);
}

export function lerNome(buf, pos) {
  const partes = [];
  let fim = null; // depois do primeiro ponteiro, o "fim" fica fixo: é onde o nome original acaba
  let i = pos;
  for (;;) {
    const tamanho = buf[i];
    if (tamanho === 0) {
      fim ??= i + 1;
      break;
    }
    if ((tamanho & 0xc0) === 0xc0) {
      // Ponteiro: os 14 bits seguintes são a posição onde o nome continua.
      fim ??= i + 2;
      i = buf.readUInt16BE(i) & 0x3fff;
      continue;
    }
    partes.push(buf.toString('ascii', i + 1, i + 1 + tamanho));
    i += 1 + tamanho;
  }
  return { nome: partes.join('.'), fim };
}

export function lerResposta(buf) {
  const id = buf.readUInt16BE(0);
  const rcode = buf.readUInt16BE(2) & 0x0f;
  const perguntas = buf.readUInt16BE(4);
  const nRespostas = buf.readUInt16BE(6);

  let pos = 12;
  for (let i = 0; i < perguntas; i++) pos = lerNome(buf, pos).fim + 4; // nome + tipo + classe

  const respostas = [];
  for (let i = 0; i < nRespostas; i++) {
    const { nome, fim } = lerNome(buf, pos);
    const tipo = buf.readUInt16BE(fim);
    const ttl = buf.readUInt32BE(fim + 4);
    const tamanho = buf.readUInt16BE(fim + 8);
    const dados = buf.subarray(fim + 10, fim + 10 + tamanho);
    respostas.push({ nome, tipo, ttl, ip: tipo === 1 ? [...dados].join('.') : null });
    pos = fim + 10 + tamanho;
  }
  return { id, rcode, respostas };
}

export function perguntar({ nome, servidor, porta = 53, timeout = 2000 }) {
  const id = randomInt(0x10000);
  const socket = dgram.createSocket('udp4');
  return new Promise((resolve, reject) => {
    const relogio = setTimeout(() => reject(new Error(`timeout: ${servidor} não respondeu em ${timeout} ms`)), timeout);
    socket.on('message', (msg) => {
      // Um id diferente é uma resposta que não é nossa: ignorar (é também uma defesa contra respostas forjadas).
      if (msg.length < 12 || msg.readUInt16BE(0) !== id) return;
      clearTimeout(relogio);
      resolve(lerResposta(msg));
    });
    socket.on('error', (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    socket.send(construirPergunta(id, nome), porta, servidor);
  }).finally(() => socket.close());
}
```
</details>

### P3 · Um cliente HTTP sobre TCP (≈40 min)

**Ficheiro:** `httpCru.js`

Sem `fetch` nem `node:http`: abres uma ligação TCP, escreves o pedido em texto, juntas os bytes da resposta, separas o cabeçalho do corpo e, quando o servidor envia o corpo aos bocados (`chunked`), juntas os pedaços. É o que o `fetch` faz por ti, todas as vezes.

**Sintaxe que vais praticar:** `net.connect`, eventos `data`/`end`/`error`, `Buffer.concat`, `indexOf` num `Buffer`, `parseInt(x, 16)`, `Buffer.from(texto, 'utf8').length`.

<details>
<summary>Pista</summary>

Trabalha com `Buffer`s até ao fim, e só converte o corpo para texto no último passo: se converteres antes, o tamanho dos pedaços (em bytes) deixa de bater certo com os caracteres. O `Connection: close` simplifica tudo: a resposta acabou quando a ligação fecha (o evento `end`).
</details>

<details>
<summary>Solução de referência</summary>

```js
import net from 'node:net';

export function pedir({ host, porta, caminho, metodo = 'GET', cabecalhos = {}, corpo }) {
  return new Promise((resolve, reject) => {
    const corpoBytes = corpo === undefined ? null : Buffer.from(corpo, 'utf8');
    const linhas = [
      `${metodo} ${caminho} HTTP/1.1`,
      `Host: ${host}:${porta}`,
      'Connection: close',
      ...Object.entries(cabecalhos).map(([k, v]) => `${k}: ${v}`),
      ...(corpoBytes ? [`Content-Length: ${corpoBytes.length}`] : []),
    ];

    const socket = net.connect(porta, host, () => {
      socket.write(`${linhas.join('\r\n')}\r\n\r\n`);
      if (corpoBytes) socket.write(corpoBytes);
    });

    const pedacos = [];
    socket.on('data', (d) => pedacos.push(d));
    socket.on('error', reject);
    socket.on('end', () => {
      const tudo = Buffer.concat(pedacos);
      const separador = tudo.indexOf('\r\n\r\n');
      const [linhaEstado, ...resto] = tudo.subarray(0, separador).toString('latin1').split('\r\n');
      const status = Number(linhaEstado.split(' ')[1]);
      const cabs = {};
      for (const linha of resto) {
        const i = linha.indexOf(':');
        cabs[linha.slice(0, i).trim().toLowerCase()] = linha.slice(i + 1).trim();
      }
      let corpoResposta = tudo.subarray(separador + 4);
      if (cabs['transfer-encoding'] === 'chunked') corpoResposta = juntarPedacos(corpoResposta);
      resolve({ status, cabecalhos: cabs, corpo: corpoResposta.toString('utf8') });
    });
  });
}

// <tamanho em hex>\r\n<dados>\r\n ... 0\r\n\r\n  →  os dados todos seguidos
function juntarPedacos(buf) {
  const partes = [];
  let pos = 0;
  for (;;) {
    const fimLinha = buf.indexOf('\r\n', pos);
    const tamanho = parseInt(buf.toString('latin1', pos, fimLinha), 16);
    if (!tamanho) break;
    partes.push(buf.subarray(fimLinha + 2, fimLinha + 2 + tamanho));
    pos = fimLinha + 2 + tamanho + 2; // salta os dados e o \r\n que os fecha
  }
  return Buffer.concat(partes);
}
```
</details>

### P4 · Ler um certificado TLS (≈20 min)

**Ficheiro:** `tls.js`

Ligar a um servidor TLS e devolver o que interessa do certificado: para quem é, quem o emitiu, até quando é válido, e se o Node confia nele. Os testes geram um certificado autoassinado e mostram a diferença entre "não confio" e "confio, porque mo deste".

**Sintaxe que vais praticar:** `tls.connect` com `servername`, `ca` e `rejectUnauthorized`, `getPeerCertificate`, `authorized`/`authorizationError`, `getProtocol`.

<details>
<summary>Solução de referência</summary>

```js
import tls from 'node:tls';

export function inspecionar({ host, porta, ca, servername }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: porta, ca, servername: servername ?? host, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({
          autorizado: socket.authorized,
          erro: socket.authorizationError ?? null,
          protocolo: socket.getProtocol(),
          sujeito: cert.subject?.CN,
          emissor: cert.issuer?.CN,
          validoAte: new Date(cert.valid_to),
          nomes: (cert.subjectaltname ?? '')
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.startsWith('DNS:'))
            .map((n) => n.slice(4)),
        });
        socket.end();
      },
    );
    socket.on('error', reject);
  });
}
```

Repara que o `rejectUnauthorized: false` só faz sentido numa ferramenta de diagnóstico como esta. Numa app, desligá-lo "para funcionar" é aceitar que qualquer pessoa no caminho se faça passar pelo servidor.
</details>

## Experiências

1. **O teu DNS contra um servidor real:** num ficheiro `.mjs` dentro de `pratica/25-redes/`, importa o teu `perguntar` e chama-o com `{ nome: 'github.com', servidor: '1.1.1.1' }`. Compara com `dig +short github.com @1.1.1.1`. Depois, observa os pacotes com `sudo tcpdump -i any -n port 53` enquanto corres o teu programa.
2. **O teu HTTP contra um site real:** o teu `pedir` só fala HTTP, sem TLS. Experimenta com `{ host: 'example.com', porta: 80, caminho: '/' }`. Para HTTPS, terias de trocar o `net.connect` por um `tls.connect`. Tenta: é uma linha.
3. **O que o curl vê:** `curl -v https://github.com -o /dev/null`. Identifica no output a resolução do nome, a ligação TCP, o TLS (versão e certificado) e os cabeçalhos.
4. **Latência real:** `ping -c 5 1.1.1.1` e `mtr -rwc 10 github.com` (se tiveres o `mtr`). Quantos routers há entre ti e o GitHub? Onde está o salto maior?
5. **A rede do Docker:** com a stack a correr, `docker network inspect workshop_default | jq '.[0].IPAM.Config, [.[0].Containers[] | {Name, IPv4Address}]'`. Em que rede privada vivem os contentores? Usa o teu `naRede` para confirmar.

## Perguntas de pensamento crítico

1. Um utilizador diz que "o site não abre". O que lhe pedes para correr, e como distingues um problema de DNS de um de TCP e de um de TLS?
2. Mudaste o IP do servidor no DNS há 10 minutos e metade dos utilizadores ainda vai ao antigo. Porquê, e o que devias ter feito antes?
3. Porque é que o DNS usa UDP e a base de dados usa TCP?

<details>
<summary>Respostas</summary>

1. `nslookup` ou `dig` do nome (se não resolve, é DNS); `curl -v https://site` (o output diz até onde chegou: se para em "Trying 1.2.3.4..." sem ligar, é TCP, seja firewall ou servidor em baixo; se liga mas falha com um erro de certificado, é TLS; se chega a receber um status, é HTTP ou a própria aplicação). Pedir o erro exato do browser também ajuda: `ERR_NAME_NOT_RESOLVED`, `ERR_CONNECTION_TIMED_OUT` e `NET::ERR_CERT_DATE_INVALID` apontam cada um para uma camada.
2. Por causa do TTL: os resolvedores guardaram a resposta antiga em cache e só vão perguntar outra vez quando o TTL expirar. Devias ter baixado o TTL (ex.: para 60 segundos) um TTL antigo inteiro antes da migração, e só depois mudado o IP; no fim, volta-se a subir.
3. Uma pergunta DNS cabe num só pacote, e a resposta também: abrir uma ligação TCP (uma ida e volta a mais) duplicaria o tempo de cada resolução, e se um pacote se perder, basta perguntar outra vez. Uma base de dados troca muitas mensagens grandes numa conversa longa, com transações, e precisa que cheguem todas, por ordem e sem duplicados: exatamente o que o TCP garante. (O DNS também usa TCP quando a resposta é grande demais para um pacote, e as versões cifradas, DoT e DoH, usam TCP ou QUIC.)
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 25`.

**1.** Quantos endereços tem a rede 10.0.0.0/24?

- a) 24
- b) 256
- c) 65 536
- d) 16 777 216

<details><summary>Resposta</summary>

**b) 256** — Sobram 32 - 24 = 8 bits para os endereços: 2^8 = 256.

</details>

**2.** Um pedido falha com ECONNREFUSED. Em que camada está o problema mais provável?

- a) DNS: o nome não existe
- b) TCP: a máquina respondeu, mas ninguém está a ouvir nessa porta
- c) TLS: o certificado expirou
- d) HTTP: a API devolveu 500

<details><summary>Resposta</summary>

**b) TCP: a máquina respondeu, mas ninguém está a ouvir nessa porta** — Uma firewall que deita fora os pacotes dá ETIMEDOUT; um 'não há ninguém nessa porta' dá ECONNREFUSED.

</details>

**3.** Porque é que o HTTP/1.1 precisa do Content-Length ou do Transfer-Encoding: chunked?

- a) Para comprimir o corpo
- b) Porque o TCP é um stream de bytes sem fronteiras: sem isso, quem recebe não sabe onde acaba a resposta
- c) Para o browser mostrar uma barra de progresso
- d) Porque o TLS o exige

<details><summary>Resposta</summary>

**b) Porque o TCP é um stream de bytes sem fronteiras: sem isso, quem recebe não sabe onde acaba a resposta** — O TCP não tem mensagens; é o protocolo por cima que tem de dizer onde cada uma acaba.

</details>

**4.** Que campo de um registo DNS diz durante quantos segundos a resposta pode ficar em cache (sigla em inglês)?

<details><summary>Resposta</summary>

**ttl** — Antes de mudares um IP, baixa o TTL com antecedência.

</details>

**5.** Um certificado TLS autoassinado é recusado porque...

- a) usa uma cifra fraca
- b) não foi assinado por uma autoridade de certificação em que o cliente confie
- c) não tem data de validade
- d) só funciona com HTTP/1.1

<details><summary>Resposta</summary>

**b) não foi assinado por uma autoridade de certificação em que o cliente confie** — Serve para testes e redes internas, se o cliente receber explicitamente esse certificado como de confiança (a opção ca).

</details>

<!-- quiz:end -->
