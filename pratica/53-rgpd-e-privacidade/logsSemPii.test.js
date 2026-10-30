import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { limparObjeto, limparTexto, luhn } from './logsSemPii.js';

describe('P2 · luhn', () => {
  it('aceita números de cartão de teste válidos', () => {
    assert.equal(luhn('4111111111111111'), true);
    assert.equal(luhn('5555555555554444'), true);
  });
  it('rejeita os inválidos', () => {
    assert.equal(luhn('4111111111111112'), false);
    assert.equal(luhn('1234567890123'), false);
  });
});

describe('P2 · limparTexto', () => {
  it('troca emails', () => {
    assert.equal(limparTexto('login falhou para ana.silva+x@exemplo.com.pt às 10h'), 'login falhou para [email] às 10h');
  });
  it('troca cartões válidos, com ou sem separadores', () => {
    assert.equal(limparTexto('pagou com 4111 1111 1111 1111 hoje'), 'pagou com [cartao] hoje');
    assert.equal(limparTexto('cartão 5555-5555-5555-4444'), 'cartão [cartao]');
  });
  it('não toca em números compridos que não são cartões', () => {
    assert.equal(limparTexto('encomenda 1234567890123 criada'), 'encomenda 1234567890123 criada');
  });
  it('troca telemóveis portugueses', () => {
    assert.equal(limparTexto('ligar para 912345678'), 'ligar para [telefone]');
    assert.equal(limparTexto('ou +351 912 345 678.'), 'ou [telefone].');
  });
  it('não confunde outros números', () => {
    assert.equal(limparTexto('pedido 42 demorou 812345678 ns'), 'pedido 42 demorou 812345678 ns');
  });
});

describe('P2 · limparObjeto', () => {
  it('remove campos sensíveis e limpa textos, em profundidade', () => {
    const entrada = {
      msg: 'registo de ana@exemplo.pt',
      utilizador: { id: 7, Password: 'x', NIF: '123456789', contactos: ['912345678', 'outro'] },
      headers: { authorization: 'Bearer abc' },
      ok: true,
      n: null,
    };
    assert.deepEqual(limparObjeto(entrada), {
      msg: 'registo de [email]',
      utilizador: { id: 7, Password: '[removido]', NIF: '[removido]', contactos: ['[telefone]', 'outro'] },
      headers: { authorization: '[removido]' },
      ok: true,
      n: null,
    });
  });
  it('não muda o original', () => {
    const o = { password: 'x' };
    limparObjeto(o);
    assert.equal(o.password, 'x');
  });
});
