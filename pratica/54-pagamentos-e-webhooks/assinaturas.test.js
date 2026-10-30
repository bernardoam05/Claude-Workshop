import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { ErroAssinatura, assinar, verificar } from './assinaturas.js';

const segredo = 'whsec_teste';
const corpo = '{"id":"evt_1","tipo":"pagamento.capturado","valor":1230}';
const t = 1_793_000_000;

describe('P2 · assinar', () => {
  it('HMAC-SHA256 de "t.corpo"', () => {
    const hex = createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex');
    assert.equal(assinar(corpo, segredo, t), `t=${t},v1=${hex}`);
  });
});

describe('P2 · verificar', () => {
  const cab = assinar(corpo, segredo, t);
  it('aceita uma assinatura válida dentro da tolerância', () => {
    assert.equal(verificar(corpo, cab, segredo, { agora: t + 100 }), true);
  });
  it('recusa um corpo alterado (nem um espaço)', () => {
    assert.throws(() => verificar(corpo.replace('1230', '1'), cab, segredo, { agora: t }), ErroAssinatura);
    assert.throws(() => verificar(JSON.stringify(JSON.parse(corpo), null, 1), cab, segredo, { agora: t }), /não confere/);
  });
  it('recusa outro segredo', () => {
    assert.throws(() => verificar(corpo, cab, 'outro', { agora: t }), /não confere/);
  });
  it('recusa pedidos antigos (repetição)', () => {
    assert.throws(() => verificar(corpo, cab, segredo, { agora: t + 301 }), /prazo/);
    assert.equal(verificar(corpo, cab, segredo, { agora: t + 1000, tolerancia: 1000 }), true);
  });
  it('recusa cabeçalhos mal formados ou em falta', () => {
    for (const c of [undefined, '', `t=${t}`, 'v1=abc', `t=agora,v1=abc`]) {
      assert.throws(() => verificar(corpo, c, segredo, { agora: t }), /inválido/, String(c));
    }
  });
  it('não rebenta com assinaturas de outro comprimento', () => {
    assert.throws(() => verificar(corpo, `t=${t},v1=abc`, segredo, { agora: t }), /não confere/);
  });
  it('rotação: várias v1 e vários segredos', () => {
    const nova = assinar(corpo, 'novo', t).split(',')[1];
    const velha = assinar(corpo, segredo, t).split(',')[1];
    assert.equal(verificar(corpo, `t=${t},${nova},${velha}`, segredo, { agora: t }), true);
    assert.equal(verificar(corpo, `t=${t},${nova}`, [segredo, 'novo'], { agora: t }), true);
  });
});
