import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lerCookies, serializarCookie } from './cookies.js';

describe('P1 · serializarCookie', () => {
  it('um cookie de sessão bem configurado', () => {
    assert.equal(
      serializarCookie('__Host-sessao', 'abc 123', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 3600 }),
      '__Host-sessao=abc%20123; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
  });
  it('só põe o que é pedido, pela ordem certa', () => {
    assert.equal(serializarCookie('tema', 'escuro'), 'tema=escuro');
    assert.equal(serializarCookie('a', '1', { domain: 'exemplo.pt', path: '/app', maxAge: 0 }), 'a=1; Max-Age=0; Domain=exemplo.pt; Path=/app');
  });
  it('recusa nomes inválidos', () => {
    assert.throws(() => serializarCookie('a b', '1'), /inválido/);
    assert.throws(() => serializarCookie('a;b', '1'), /inválido/);
  });
  it('SameSite=None sem Secure', () => {
    assert.throws(() => serializarCookie('a', '1', { sameSite: 'None' }), /Secure/);
  });
  it('as regras dos prefixos', () => {
    assert.throws(() => serializarCookie('__Secure-x', '1'), /__Secure-/);
    assert.throws(() => serializarCookie('__Host-x', '1', { secure: true }), /__Host-/);
    assert.throws(() => serializarCookie('__Host-x', '1', { secure: true, path: '/', domain: 'exemplo.pt' }), /__Host-/);
    assert.equal(serializarCookie('__Secure-x', '1', { secure: true }), '__Secure-x=1; Secure');
  });
});

describe('P1 · lerCookies', () => {
  it('lê e descodifica', () => {
    assert.deepEqual(lerCookies('a=1; b=x%20y;c=='), { a: '1', b: 'x y', c: '=' });
  });
  it('o primeiro ganha, e lixo não rebenta', () => {
    assert.deepEqual(lerCookies('a=1; a=2; semigual; =x; m=%E0%A4%A'), { a: '1', m: '%E0%A4%A' });
  });
  it('sem cabeçalho', () => {
    assert.deepEqual(lerCookies(), {});
  });
});
