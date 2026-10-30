import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { construirPergunta, lerNome, lerResposta, perguntar } from './dns.js';

const hex = (s) => Buffer.from(s.replace(/\s+/g, ''), 'hex');

// Uma resposta real (com compressão): api.ex.pt → CNAME web.ex.pt → A 1.2.3.4
const RESPOSTA = hex(`
  1234 8180 0001 0002 0000 0000
  03617069 026578 027074 00  0001 0001
  c00c 0005 0001 0000012c 0006  03776562 c010
  c027 0001 0001 0000003c 0004  01020304
`);

describe('P2 · construirPergunta', () => {
  it('produz os bytes exatos de uma pergunta A', () => {
    assert.deepEqual(
      construirPergunta(0x1234, 'api.ex.pt'),
      hex('1234 0100 0001 0000 0000 0000 03617069 026578 027074 00 0001 0001'),
    );
  });

  it('aceita um ponto final no nome (o nome "absoluto")', () => {
    assert.deepEqual(construirPergunta(1, 'ex.pt.'), construirPergunta(1, 'ex.pt'));
  });
});

describe('P2 · lerNome e lerResposta', () => {
  it('lê um nome sem compressão', () => {
    assert.deepEqual(lerNome(RESPOSTA, 12), { nome: 'api.ex.pt', fim: 23 });
  });

  it('segue os ponteiros de compressão', () => {
    assert.deepEqual(lerNome(RESPOSTA, 27), { nome: 'api.ex.pt', fim: 29 });   // c00c: o nome todo noutro sítio
    assert.deepEqual(lerNome(RESPOSTA, 39), { nome: 'web.ex.pt', fim: 45 });   // "web" + ponteiro para "ex.pt"
  });

  it('lê as respostas: id, rcode, tipo, ttl e o IP dos registos A', () => {
    assert.deepEqual(lerResposta(RESPOSTA), {
      id: 0x1234,
      rcode: 0,
      respostas: [
        { nome: 'api.ex.pt', tipo: 5, ttl: 300, ip: null },
        { nome: 'web.ex.pt', tipo: 1, ttl: 60, ip: '1.2.3.4' },
      ],
    });
  });

  it('NXDOMAIN: rcode 3 e nenhuma resposta', () => {
    const nx = hex('abcd 8183 0001 0000 0000 0000 026e6f 027074 00 0001 0001');
    assert.deepEqual(lerResposta(nx), { id: 0xabcd, rcode: 3, respostas: [] });
  });
});

describe('P2 · perguntar (UDP)', () => {
  // Um servidor DNS falso: responde 9.9.9.9 a qualquer pergunta A, com o mesmo id,
  // mas ANTES manda uma resposta com um id errado (um atacante, ou uma resposta atrasada).
  async function servidorFalso({ calado = false } = {}) {
    const s = dgram.createSocket('udp4');
    s.on('message', (msg, de) => {
      if (calado) return;
      const pergunta = msg.subarray(12);
      const resposta = (id) =>
        Buffer.concat([
          Buffer.from([id >> 8, id & 0xff, 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0]),
          pergunta,
          hex('c00c 0001 0001 00000078 0004 09090909'),
        ]);
      const id = msg.readUInt16BE(0);
      s.send(resposta((id + 1) & 0xffff), de.port, de.address);
      s.send(resposta(id), de.port, de.address);
    });
    s.bind(0, '127.0.0.1');
    await once(s, 'listening');
    return { porta: s.address().port, fechar: () => s.close() };
  }

  it('envia a pergunta, ignora respostas com outro id, e lê a certa', async () => {
    const s = await servidorFalso();
    try {
      const r = await perguntar({ nome: 'qualquer.pt', servidor: '127.0.0.1', porta: s.porta });
      assert.equal(r.rcode, 0);
      assert.deepEqual(r.respostas, [{ nome: 'qualquer.pt', tipo: 1, ttl: 120, ip: '9.9.9.9' }]);
    } finally {
      s.fechar();
    }
  });

  it('desiste com timeout se o servidor não responder', async () => {
    const s = await servidorFalso({ calado: true });
    try {
      await assert.rejects(perguntar({ nome: 'x.pt', servidor: '127.0.0.1', porta: s.porta, timeout: 300 }), /timeout/);
    } finally {
      s.fechar();
    }
  });
});
