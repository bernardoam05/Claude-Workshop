import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rapido } from './ajuda.js';
import { ehPalindromo, maiorSemRepetir, somaMaximaJanela } from './janelas.js';

describe('P2 · ehPalindromo', () => {
  it('ignora pontuação, espaços e maiúsculas', () => {
    assert.equal(ehPalindromo('Ana, voa? Ova, na!'), true);
    assert.equal(ehPalindromo('A man, a plan, a canal: Panama'), true);
    assert.equal(ehPalindromo('race a car'), false);
    assert.equal(ehPalindromo(''), true);
    assert.equal(ehPalindromo('.,'), true);
    assert.equal(ehPalindromo('0P'), false);
  });

  it('não inverte a string (dois ponteiros)', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./janelas.js', import.meta.url), 'utf8');
    const corpo = codigo.slice(codigo.indexOf('export function ehPalindromo'), codigo.indexOf('export function maiorSemRepetir'));
    assert.ok(!/\.reverse\(/.test(corpo), 'o exercício é com dois ponteiros, sem .reverse()');
    assert.equal(ehPalindromo('aba'), true);
  });
});

describe('P2 · maiorSemRepetir', () => {
  it('casos clássicos', () => {
    assert.equal(maiorSemRepetir('abcabcbb'), 3);
    assert.equal(maiorSemRepetir('bbbbb'), 1);
    assert.equal(maiorSemRepetir('pwwkew'), 3);
    assert.equal(maiorSemRepetir(''), 0);
    assert.equal(maiorSemRepetir('abba'), 2, 'o início da janela nunca anda para trás');
    assert.equal(maiorSemRepetir('dvdf'), 3);
  });

  it('O(n) com 200 000 caracteres', () => {
    const texto = 'abcdefghijklmnopqrstuvwxyz'.repeat(8_000);
    assert.equal(rapido(() => maiorSemRepetir(texto), 300, 'maiorSemRepetir'), 26);
  });
});

describe('P2 · somaMaximaJanela', () => {
  it('a maior soma de k seguidos', () => {
    assert.equal(somaMaximaJanela([1, 4, 2, 10, 2, 3, 1, 0, 20], 4), 24);
    assert.equal(somaMaximaJanela([-3, -1, -2], 2), -3, 'com negativos');
    assert.equal(somaMaximaJanela([5], 1), 5);
  });

  it('k inválido', () => {
    assert.equal(somaMaximaJanela([1, 2], 2), 3);
    assert.throws(() => somaMaximaJanela([1, 2], 3));
    assert.throws(() => somaMaximaJanela([1, 2], 0));
  });

  it('O(n): 200 000 números, janela de 50 000', () => {
    const nums = Array.from({ length: 200_000 }, (_, i) => i % 7);
    rapido(() => somaMaximaJanela(nums, 50_000), 200, 'somaMaximaJanela');
  });
});
