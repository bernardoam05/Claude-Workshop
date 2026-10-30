import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { clienteFalso } from './ajuda.js';
import { comTentativas, transmitir } from './conversa.js';
import { mensagem, texto } from './servidorFalso.js';

describe('P2 · transmitir (streaming)', () => {
  it('entrega o texto aos pedaços e devolve a resposta completa', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('Lisboa é a capital de Portugal.')] }));
      const pedacos = [];
      const historico = [{ role: 'user', content: 'Qual é a capital de Portugal?' }];
      const r = await transmitir(cliente, historico, (p) => pedacos.push(p));
      assert.ok(pedacos.length > 3, 'o texto devia chegar em vários pedaços');
      assert.equal(pedacos.join(''), 'Lisboa é a capital de Portugal.');
      assert.equal(r.resposta, 'Lisboa é a capital de Portugal.');
      assert.equal(r.tokens, 8);
      assert.equal(falso.pedidos[0].corpo.stream, true, 'o pedido devia ser em streaming');
    } finally {
      falso.fechar();
    }
  });

  it('a conversa cresce: a segunda pergunta envia a primeira troca inteira', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('Chamas-te Ana.')] }), mensagem({ content: [texto('A.')] }));
      const h0 = [{ role: 'user', content: 'Chamo-me Ana. Como me chamo?' }];
      const { historico: h1 } = await transmitir(cliente, h0, () => {});
      assert.equal(h0.length, 1, 'não alteres o array que recebeste');
      assert.equal(h1.at(-1).role, 'assistant');
      await transmitir(cliente, [...h1, { role: 'user', content: 'Qual é a primeira letra?' }], () => {});
      const enviadas = falso.pedidos[1].corpo.messages;
      assert.equal(enviadas.length, 3);
      assert.deepEqual(enviadas.map((m) => m.role), ['user', 'assistant', 'user']);
      assert.equal(enviadas[1].content[0].text, 'Chamas-te Ana.');
    } finally {
      falso.fechar();
    }
  });
});

describe('P2 · comTentativas', () => {
  it('repete os erros temporários (429, 5xx) e acaba por ter sucesso', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder({ erro: 429, tipo: 'rate_limit_error' }, { erro: 529, tipo: 'overloaded_error' }, mensagem({ content: [texto('ok')] }));
      const esperas = [];
      const r = await comTentativas(
        () => cliente.messages.create({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }),
        { tentativas: 3, espera: (n) => (esperas.push(n), 1) },
      );
      assert.equal(r.content[0].text, 'ok');
      assert.deepEqual(esperas, [0, 1]);
    } finally {
      falso.fechar();
    }
  });

  it('um 400 não se repete (o pedido está errado, repeti-lo não ajuda)', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder({ erro: 400, tipo: 'invalid_request_error' }, mensagem({ content: [texto('não devia chegar aqui')] }));
      await assert.rejects(
        comTentativas(() => cliente.messages.create({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }), { espera: () => 1 }),
        Anthropic.BadRequestError,
      );
      assert.equal(falso.pedidos.length, 1);
    } finally {
      falso.fechar();
    }
  });

  it('esgotadas as tentativas, propaga o último erro', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder({ erro: 429, tipo: 'rate_limit_error' }, { erro: 429, tipo: 'rate_limit_error' });
      await assert.rejects(
        comTentativas(() => cliente.messages.create({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }), { tentativas: 2, espera: () => 1 }),
        Anthropic.RateLimitError,
      );
      assert.equal(falso.pedidos.length, 2);
    } finally {
      falso.fechar();
    }
  });
});
