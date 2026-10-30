// Um servidor que se faz passar pela Messages API da Anthropic, para os testes não precisarem de
// uma chave nem de Internet (e não gastarem dinheiro). O SDK fala com ele como falaria com a API:
//   new Anthropic({ apiKey: 'teste', baseURL: falso.url })
//
// Os testes dizem-lhe o que responder, por ordem (responder(...)), e depois leem os pedidos que
// ele recebeu (falso.pedidos), para confirmar o que o TEU código enviou.
// Se o pedido tiver "stream": true, a mesma resposta é enviada como Server-Sent Events, com os
// eventos reais: message_start, content_block_start/delta/stop, message_delta, message_stop.
import { once } from 'node:events';
import http from 'node:http';

let contador = 0;

// mensagem({ content, stop_reason }) → um objeto Message como a API o devolveria
export function mensagem({ content, stop_reason = 'end_turn', model = 'claude-opus-5-5' }) {
  return {
    id: `msg_falso_${++contador}`,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 * content.length + 3 },
  };
}

export const texto = (t) => ({ type: 'text', text: t });
export const ferramenta = (id, name, input) => ({ type: 'tool_use', id, name, input });

function eventos(msg) {
  const ev = [];
  const enviar = (type, dados) => ev.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...dados })}\n\n`);
  enviar('message_start', { message: { ...msg, content: [], stop_reason: null, usage: { ...msg.usage, output_tokens: 1 } } });
  msg.content.forEach((bloco, index) => {
    if (bloco.type === 'text') {
      enviar('content_block_start', { index, content_block: { type: 'text', text: '' } });
      // O texto chega aos bocados (de 4 em 4 caracteres), como na API real.
      for (let i = 0; i < bloco.text.length; i += 4) {
        enviar('content_block_delta', { index, delta: { type: 'text_delta', text: bloco.text.slice(i, i + 4) } });
      }
    } else if (bloco.type === 'tool_use') {
      enviar('content_block_start', { index, content_block: { ...bloco, input: {} } });
      const json = JSON.stringify(bloco.input);
      for (let i = 0; i < json.length; i += 8) {
        enviar('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 8) } });
      }
    }
    enviar('content_block_stop', { index });
  });
  enviar('message_delta', { delta: { stop_reason: msg.stop_reason, stop_sequence: null }, usage: { output_tokens: msg.usage.output_tokens } });
  enviar('message_stop', {});
  return ev;
}

export async function arrancarFalso() {
  const fila = [];
  const pedidos = [];
  const server = http.createServer(async (req, res) => {
    let corpo = '';
    for await (const c of req) corpo += c;
    const json = corpo ? JSON.parse(corpo) : null;
    pedidos.push({ caminho: req.url, cabecalhos: req.headers, corpo: json });
    const proxima = fila.shift();
    if (!proxima) {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'o servidor falso não tinha mais respostas preparadas' } }));
    }
    if (proxima.erro) {
      res.writeHead(proxima.erro, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: proxima.tipo ?? 'api_error', message: proxima.mensagem ?? 'erro' } }));
    }
    if (json?.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const e of eventos(proxima)) res.write(e);
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(proxima));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    pedidos,
    // responder(msg1, msg2, ...): as próximas respostas, por ordem. { erro: 429 } simula um erro HTTP.
    responder: (...respostas) => fila.push(...respostas),
    fechar: () => server.close(),
  };
}
