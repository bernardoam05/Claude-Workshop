import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verificarPassword } from './passwords.js';

describe('P2 · passwords', () => {
  it('o hash tem o formato scrypt$<sal>$<hash>, com 16 e 64 bytes', async () => {
    const guardado = await hashPassword('correct horse battery staple');
    const [algoritmo, sal, hash] = guardado.split('$');
    assert.equal(algoritmo, 'scrypt');
    assert.equal(Buffer.from(sal, 'base64').length, 16);
    assert.equal(Buffer.from(hash, 'base64').length, 64);
    assert.ok(!guardado.includes('correct horse'), 'a password nunca aparece no que se guarda');
  });

  it('a mesma password dá hashes DIFERENTES (o sal é aleatório)', async () => {
    assert.notEqual(await hashPassword('igual'), await hashPassword('igual'));
  });

  it('verifica a password certa e recusa a errada', async () => {
    const guardado = await hashPassword('s3gredo!');
    assert.equal(await verificarPassword('s3gredo!', guardado), true);
    assert.equal(await verificarPassword('s3gredo?', guardado), false);
    assert.equal(await verificarPassword('', guardado), false);
  });

  it('um valor guardado mal formado dá false, nunca uma exceção', async () => {
    for (const mau of ['', 'scrypt$abc', 'bcrypt$x$y', 'scrypt$$', 'texto qualquer']) {
      assert.equal(await verificarPassword('x', mau), false, JSON.stringify(mau));
    }
  });
});
