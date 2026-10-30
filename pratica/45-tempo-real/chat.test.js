import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import WebSocketNode from 'ws';
import { ate, clienteWs, servidorHttp } from './ajuda.js';
import { criarChat } from './chat.js';

async function montar(opcoes = {}) {
  const { server, ws } = await servidorHttp();
  try {
    const chat = criarChat({ server, ...opcoes });
    return { chat, url: ws, fechar: () => (chat.fechar(), server.closeAllConnections(), server.close()) };
  } catch (e) {
    server.close(); // sem isto, o servidor ficava aberto e o processo dos testes nunca terminava
    throw e;
  }
}

describe('P3 · chat com salas', () => {
  it('entrar e conversar numa sala; as outras salas não ouvem', async () => {
    const { chat, url, fechar } = await montar();
    try {
      const ana = await clienteWs(url);
      const bruno = await clienteWs(url);
      const carla = await clienteWs(url);
      ana.enviar({ tipo: 'entrar', sala: 'geral', nome: 'Ana' });
      await ate(() => ana.recebidas.length === 1);
      bruno.enviar({ tipo: 'entrar', sala: 'geral', nome: 'Bruno' });
      carla.enviar({ tipo: 'entrar', sala: 'outra', nome: 'Carla' });
      await ate(() => chat.salas().geral === 2 && chat.salas().outra === 1);
      ana.enviar({ tipo: 'mensagem', texto: 'Olá!' });
      await ate(() => bruno.recebidas.some((m) => m.tipo === 'mensagem'));
      assert.deepEqual(ana.recebidas, [
        { tipo: 'entrou', nome: 'Ana' },
        { tipo: 'entrou', nome: 'Bruno' },
        { tipo: 'mensagem', nome: 'Ana', texto: 'Olá!' },
      ]);
      assert.deepEqual(bruno.recebidas.at(-1), { tipo: 'mensagem', nome: 'Ana', texto: 'Olá!' });
      assert.ok(!carla.recebidas.some((m) => m.tipo === 'mensagem'), 'a Carla está noutra sala');
      assert.deepEqual(chat.salas(), { geral: 2, outra: 1 });
    } finally {
      fechar();
    }
  });

  it('mudar de sala tira o cliente da anterior', async () => {
    const { chat, url, fechar } = await montar();
    try {
      const ana = await clienteWs(url);
      ana.enviar({ tipo: 'entrar', sala: 'a', nome: 'Ana' });
      ana.enviar({ tipo: 'entrar', sala: 'b', nome: 'Ana' });
      assert.ok(await ate(() => chat.salas().b === 1));
      assert.deepEqual(chat.salas(), { b: 1 });
    } finally {
      fechar();
    }
  });

  it('erros: só o próprio cliente os recebe', async () => {
    const { url, fechar } = await montar();
    try {
      const ana = await clienteWs(url);
      ana.enviar('isto não é json');
      ana.enviar({ tipo: 'mensagem', texto: 'sem sala' });
      ana.enviar({ tipo: 'entrar', sala: 's', nome: 'Ana' });
      ana.enviar({ tipo: 'mensagem', texto: '' });
      ana.enviar({ tipo: 'mensagem', texto: 'x'.repeat(501) });
      ana.enviar({ tipo: 'dancar' });
      await ate(() => ana.recebidas.filter((m) => m.tipo === 'erro').length === 5);
      assert.deepEqual(ana.recebidas.filter((m) => m.tipo === 'erro').map((m) => m.motivo), ['json', 'sem-sala', 'texto', 'texto', 'tipo']);
    } finally {
      fechar();
    }
  });

  it('quando alguém se desliga, a sala é avisada', async () => {
    const { chat, url, fechar } = await montar();
    try {
      const ana = await clienteWs(url);
      const bruno = await clienteWs(url);
      ana.enviar({ tipo: 'entrar', sala: 'geral', nome: 'Ana' });
      bruno.enviar({ tipo: 'entrar', sala: 'geral', nome: 'Bruno' });
      await ate(() => chat.salas().geral === 2);
      bruno.ws.close();
      assert.ok(await ate(() => ana.recebidas.some((m) => m.tipo === 'saiu')));
      assert.deepEqual(ana.recebidas.at(-1), { tipo: 'saiu', nome: 'Bruno' });
      assert.deepEqual(chat.salas(), { geral: 1 });
    } finally {
      fechar();
    }
  });

  it('o batimento termina as ligações mortas (que não respondem ao ping)', async () => {
    const { chat, url, fechar } = await montar({ batimentoMs: 80 });
    try {
      // Um cliente "morto": não responde aos pings (autoPong: false). O WebSocket normal responde sozinho.
      const morto = new WebSocketNode(url, { autoPong: false });
      await once(morto, 'open');
      morto.send(JSON.stringify({ tipo: 'entrar', sala: 'geral', nome: 'Morto' }));
      const vivo = await clienteWs(url);
      vivo.enviar({ tipo: 'entrar', sala: 'geral', nome: 'Vivo' });
      await ate(() => chat.salas().geral === 2);
      assert.ok(await ate(() => morto.readyState === WebSocketNode.CLOSED, 1500), 'a ligação morta devia ter sido terminada');
      assert.equal(vivo.ws.readyState, WebSocket.OPEN, 'o cliente que responde aos pings tem de continuar ligado');
      assert.deepEqual(chat.salas(), { geral: 1 });
    } finally {
      fechar();
    }
  });
});
