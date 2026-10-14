import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jsonwebtoken from 'jsonwebtoken';
import { assinar, verificar } from './jwt.js';

const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const AGORA = 1_800_000_000; // um instante fixo, em segundos

// Decodifica uma parte do token (sem verificar nada), para inspecionar o que lá está.
const parte = (token, i) => JSON.parse(Buffer.from(token.split('.')[i], 'base64url').toString());

// Troca o payload de um token, mantendo a assinatura antiga (um ataque clássico).
function adulterar(token, novoPayload) {
  const [h, , s] = token.split('.');
  return [h, Buffer.from(JSON.stringify(novoPayload)).toString('base64url'), s].join('.');
}

describe('P1 · assinar', () => {
  it('produz três partes base64url, com o cabeçalho HS256', () => {
    const token = assinar({ sub: '7' }, SEGREDO);
    assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/, 'base64url: sem "=", "+" nem "/"');
    assert.deepEqual(parte(token, 0), { alg: 'HS256', typ: 'JWT' });
    assert.deepEqual(parte(token, 1), { sub: '7' });
  });

  it('com expiraEm, acrescenta iat e exp', () => {
    const token = assinar({ sub: '7' }, SEGREDO, { expiraEm: 3600, agora: AGORA });
    assert.deepEqual(parte(token, 1), { sub: '7', iat: AGORA, exp: AGORA + 3600 });
  });

  it('a biblioteca jsonwebtoken (a do projeto) aceita os teus tokens', () => {
    const token = assinar({ sub: '7', papel: 'admin' }, SEGREDO);
    assert.deepEqual(jsonwebtoken.verify(token, SEGREDO, { algorithms: ['HS256'] }), { sub: '7', papel: 'admin' });
  });
});

// Os testes de "recusa" começam por confirmar que um token BOM é aceite: senão, uma função que
// lança sempre (como a que ainda está por fazer) passaria em todos.
function confirmarQueAceitaUmBom() {
  assert.equal(verificar(assinar({ sub: '7' }, SEGREDO), SEGREDO).sub, '7');
}

describe('P1 · verificar', () => {
  it('aceita tokens feitos pela jsonwebtoken', () => {
    const token = jsonwebtoken.sign({ sub: '9' }, SEGREDO, { algorithm: 'HS256', noTimestamp: true });
    assert.deepEqual(verificar(token, SEGREDO), { sub: '9' });
  });

  it('recusa um token assinado com outro segredo', () => {
    confirmarQueAceitaUmBom();
    assert.throws(() => verificar(assinar({ sub: '7' }, 'outro-segredo'), SEGREDO));
  });

  it('recusa um payload adulterado (a assinatura deixa de bater certo)', () => {
    confirmarQueAceitaUmBom();
    const token = assinar({ sub: '7', papel: 'user' }, SEGREDO);
    assert.throws(() => verificar(adulterar(token, { sub: '7', papel: 'admin' }), SEGREDO));
  });

  it('recusa alg "none" (o ataque mais famoso aos JWT)', () => {
    confirmarQueAceitaUmBom();
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: '1', papel: 'admin' })).toString('base64url');
    assert.throws(() => verificar(`${cabecalho}.${payload}.`, SEGREDO));
  });

  it('recusa tokens expirados, e aceita-os enquanto não expiram', () => {
    const token = assinar({ sub: '7' }, SEGREDO, { expiraEm: 60, agora: AGORA });
    assert.equal(verificar(token, SEGREDO, { agora: AGORA + 59 }).sub, '7');
    assert.throws(() => verificar(token, SEGREDO, { agora: AGORA + 60 }), /expir/i);
  });

  it('recusa lixo sem rebentar de outra forma', () => {
    confirmarQueAceitaUmBom();
    for (const lixo of ['', 'abc', 'a.b', 'a.b.c', '...']) {
      assert.throws(() => verificar(lixo, SEGREDO), Error, JSON.stringify(lixo));
    }
  });
});
