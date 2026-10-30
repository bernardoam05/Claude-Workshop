import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebSocketServer } from 'ws';
import { ate, servidorHttp } from './ajuda.js';
import { ClienteResiliente, esperaAntesDe } from './clienteResiliente.js';

describe('P4 · esperaAntesDe', () => {
  it('cresce para o dobro, com teto, e multiplica pelo aleatório', () => {
    const max = (t) => esperaAntesDe(t, { aleatorio: () => 1 });
    assert.deepEqual([0, 1, 2, 3, 4, 5, 10].map(max), [500, 1000, 2000, 4000, 8000, 10000, 10000]);
    assert.equal(esperaAntesDe(3, { aleatorio: () => 0.5 }), 2000);
    assert.equal(esperaAntesDe(0, { aleatorio: () => 0 }), 0);
    assert.equal(esperaAntesDe(2, { base: 100, maximo: 300, aleatorio: () => 1 }), 300);
  });

  it('com o aleatório a sério, os valores espalham-se', () => {
    const valores = new Set(Array.from({ length: 50 }, () => esperaAntesDe(4)));
    assert.ok(valores.size > 40);
    assert.ok([...valores].every((v) => v >= 0 && v <= 8000));
  });
});

describe('P4 · ClienteResiliente', () => {
  async function servidorEco() {
    const { server, ws: url } = await servidorHttp();
    const wss = new WebSocketServer({ server });
    const recebidas = [];
    let ligacoes = 0;
    wss.on('connection', (s) => {
      ligacoes++;
      s.on('message', (d) => {
        const m = JSON.parse(d);
        recebidas.push(m);
        s.send(JSON.stringify({ eco: m }));
      });
    });
    // derrubar(): fecha todas as ligações sem aviso, como uma queda de rede ou um deploy
    const derrubar = () => wss.clients.forEach((c) => c.terminate());
    return { url, recebidas, ligacoes: () => ligacoes, derrubar, fechar: () => (wss.close(), server.closeAllConnections(), server.close()) };
  }

  it('liga, envia, recebe, e chama o aoLigar', async () => {
    const s = await servidorEco();
    const recebidas = [];
    let ligou = 0;
    let c;
    try {
      c = new ClienteResiliente(s.url, { aoMensagem: (m) => recebidas.push(m), aoLigar: () => ligou++ });
      assert.ok(await ate(() => c.ligado));
      c.enviar({ ola: 1 });
      assert.ok(await ate(() => recebidas.length === 1));
      assert.deepEqual(recebidas[0], { eco: { ola: 1 } });
      assert.equal(ligou, 1);
    } finally {
      c?.fechar();
      s.fechar();
    }
  });

  it('volta a ligar depois de uma queda, e o aoLigar repõe o estado', async () => {
    const s = await servidorEco();
    let c;
    try {
      c = new ClienteResiliente(s.url, {
        aoMensagem: () => {},
        aoLigar: (cli) => cli.enviar({ tipo: 'entrar', sala: 'geral' }),
        espera: () => 20,
      });
      assert.ok(await ate(() => s.recebidas.length === 1));
      s.derrubar();
      assert.ok(await ate(() => s.ligacoes() === 2 && c.ligado), 'não voltou a ligar');
      assert.ok(await ate(() => s.recebidas.length === 2));
      assert.deepEqual(s.recebidas, [{ tipo: 'entrar', sala: 'geral' }, { tipo: 'entrar', sala: 'geral' }]);
    } finally {
      c?.fechar();
      s.fechar();
    }
  });

  it('as mensagens enviadas durante a queda ficam na fila e seguem, por ordem, quando voltar', async () => {
    const s = await servidorEco();
    let c;
    try {
      c = new ClienteResiliente(s.url, { aoMensagem: () => {}, espera: () => 150 });
      assert.ok(await ate(() => c.ligado));
      s.derrubar();
      assert.ok(await ate(() => !c.ligado));
      c.enviar({ n: 1 });
      c.enviar({ n: 2 });
      assert.ok(await ate(() => s.recebidas.length === 2, 3000));
      assert.deepEqual(s.recebidas, [{ n: 1 }, { n: 2 }]);
    } finally {
      c?.fechar();
      s.fechar();
    }
  });

  it('cada tentativa falhada espera mais (a contagem só volta a 0 quando liga)', async () => {
    const tentativas = [];
    let c;
    try {
      c = new ClienteResiliente('ws://127.0.0.1:9/', { aoMensagem: () => {}, espera: (t) => (tentativas.push(t), 10) });
      assert.ok(await ate(() => tentativas.length >= 3));
      assert.deepEqual(tentativas.slice(0, 3), [0, 1, 2]);
    } finally {
      c?.fechar();
    }
  });

  it('fechar() fecha de vez', async () => {
    const s = await servidorEco();
    let c;
    try {
      c = new ClienteResiliente(s.url, { aoMensagem: () => {}, espera: () => 10 });
      assert.ok(await ate(() => c.ligado));
      c.fechar();
      await ate(() => false, 200);
      assert.equal(s.ligacoes(), 1, 'depois do fechar() não pode voltar a ligar');
      assert.equal(c.ligado, false);
    } finally {
      s.fechar();
    }
  });
});
