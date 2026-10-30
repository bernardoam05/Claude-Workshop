import { once } from 'node:events';
import http from 'node:http';

export async function servidorHttp(handler = (req, res) => res.writeHead(404).end()) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}`, ws: `ws://127.0.0.1:${server.address().port}` };
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Repete até a condição ser verdadeira (o tempo real é assíncrono: as mensagens demoram um pouco).
export async function ate(condicao, ms = 2000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (condicao()) return true;
    await esperar(10);
  }
  return condicao();
}

// Um cliente WebSocket de teste (o WebSocket do browser, que o Node também tem), que guarda o que recebe.
export async function clienteWs(url) {
  const ws = new WebSocket(url);
  const recebidas = [];
  ws.addEventListener('message', (e) => recebidas.push(JSON.parse(e.data)));
  await once(ws, 'open');
  return { ws, recebidas, enviar: (o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o)) };
}
