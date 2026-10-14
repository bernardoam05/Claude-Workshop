import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarPonto, fundir, lerOpcoes, resumirUtilizador, semCampo, separar } from './basico.js';

describe('P1 · resumirUtilizador (?. ?? e template literals)', () => {
  it('com tudo', () => {
    assert.equal(resumirUtilizador({ nome: 'Ana', morada: { cidade: 'Lisboa' }, papeis: ['user', 'admin'] }), 'Ana (Lisboa) · 2 papéis');
  });
  it('sem morada, ou com morada sem cidade, ou sem papéis', () => {
    assert.equal(resumirUtilizador({ nome: 'Bruno' }), 'Bruno (sem cidade) · 0 papéis');
    assert.equal(resumirUtilizador({ nome: 'Carla', morada: {}, papeis: [] }), 'Carla (sem cidade) · 0 papéis');
  });
  it('?? e não ||: uma cidade "" é uma cidade (vazia), não "sem cidade"', () => {
    assert.equal(resumirUtilizador({ nome: 'Duarte', morada: { cidade: '' } }), 'Duarte () · 0 papéis');
  });
});

describe('P1 · separar (destructuring de arrays com rest)', () => {
  it('primeiro e resto', () => {
    assert.deepEqual(separar(['a', 'b', 'c']), { primeiro: 'a', resto: ['b', 'c'] });
    assert.deepEqual(separar([]), { primeiro: undefined, resto: [] });
  });
});

describe('P1 · semCampo (destructuring com rest e chave calculada)', () => {
  it('devolve uma cópia sem o campo, sem mexer no original', () => {
    const original = Object.freeze({ a: 1, b: 2, c: 3 });
    assert.deepEqual(semCampo(original, 'b'), { a: 1, c: 3 });
    assert.deepEqual(semCampo(original, 'z'), { a: 1, b: 2, c: 3 });
  });
});

describe('P1 · fundir (spread e parâmetros rest)', () => {
  it('o da direita ganha, e nenhum original muda', () => {
    const base = Object.freeze({ a: 1, b: 1 });
    assert.deepEqual(fundir(base, { b: 2 }, { c: 3 }), { a: 1, b: 2, c: 3 });
    assert.deepEqual(fundir(base), { a: 1, b: 1 });
    assert.notEqual(fundir(base), base, 'tem de ser um objeto novo');
  });
});

describe('P1 · criarPonto (object shorthand e métodos)', () => {
  it('tem x, y e um método distanciaA', () => {
    const p = criarPonto(0, 0);
    assert.equal(p.x, 0);
    assert.equal(p.y, 0);
    assert.equal(p.distanciaA(criarPonto(3, 4)), 5);
  });
});

describe('P1 · lerOpcoes (destructuring com valores por omissão)', () => {
  it('preenche o que falta', () => {
    assert.deepEqual(lerOpcoes({ porta: 8080 }), { porta: 8080, host: 'localhost', debug: false });
    assert.deepEqual(lerOpcoes({ debug: true, host: '0.0.0.0' }), { porta: 3000, host: '0.0.0.0', debug: true });
  });
  it('funciona sem argumento nenhum', () => {
    assert.deepEqual(lerOpcoes(), { porta: 3000, host: 'localhost', debug: false });
  });
});
