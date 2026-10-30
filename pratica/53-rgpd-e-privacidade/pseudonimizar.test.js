import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { mascararEmail, mascararFim, minimizar, pseudonimo } from './pseudonimizar.js';

describe('P1 · minimizar', () => {
  it('fica só com os campos pedidos que existem', () => {
    const u = { id: 1, email: 'a@b.pt', nif: '123456789', dataNascimento: '1990-01-01' };
    assert.deepEqual(minimizar(u, ['id', 'email', 'morada']), { id: 1, email: 'a@b.pt' });
  });
  it('não muda o original', () => {
    const u = { id: 1, nif: 'x' };
    minimizar(u, ['id']);
    assert.deepEqual(u, { id: 1, nif: 'x' });
  });
});

describe('P1 · pseudonimo', () => {
  const chave = 'segredo-de-teste';
  it('é o HMAC-SHA256 do valor normalizado', () => {
    const esperado = createHmac('sha256', chave).update('ana@exemplo.pt').digest('hex');
    assert.equal(pseudonimo('  Ana@Exemplo.PT ', chave), esperado);
  });
  it('outra chave dá outro pseudónimo', () => {
    assert.notEqual(pseudonimo('ana@exemplo.pt', 'a'), pseudonimo('ana@exemplo.pt', 'b'));
  });
});

describe('P1 · máscaras', () => {
  it('mascara o email', () => {
    assert.equal(mascararEmail('ana.silva@exemplo.pt'), 'a********@exemplo.pt');
    assert.equal(mascararEmail('a@b.pt'), 'a@b.pt');
  });
  it('recusa um email sem @', () => {
    assert.throws(() => mascararEmail('nada'), /Email inválido/);
  });
  it('mostra só o fim, mantendo os espaços', () => {
    assert.equal(mascararFim('PT50 0002 0123 1234 5678 9015 4'), '•••• •••• •••• •••• •••• •015 4');
    assert.equal(mascararFim('123456789', 3), '••••••789');
    assert.equal(mascararFim('12', 4), '12');
  });
});
