import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { propriedadesCodificador, propriedadesRepartir } from './propriedades.js';

const opcoes = { numRuns: 300, seed: 42 };
const todasPassam = (props) => props.every((p) => !fc.check(p, opcoes).failed);
const algumaFalha = (props) => props.some((p) => fc.check(p, opcoes).failed);

const certo = (c, p) => {
  const base = Math.floor(c / p);
  return Array.from({ length: p }, (_, i) => base + (i < c - base * p ? 1 : 0));
};
const mutantesRepartir = {
  'arredonda em vez de truncar': (c, p) => Array.from({ length: p }, () => Math.round(c / p)),
  'o resto vai para a última parte': (c, p) => {
    const r = Array.from({ length: p }, () => Math.floor(c / p));
    r[p - 1] += c - Math.floor(c / p) * p;
    return r;
  },
  'o resto vai para o fim, um a um': (c, p) => certo(c, p).reverse(),
  'esquece o resto': (c, p) => Array.from({ length: p }, () => Math.floor(c / p)),
  'uma parte a menos quando é exato': (c, p) => (c % p === 0 && p > 1 ? certo(c, p).slice(1) : certo(c, p)),
};

const codificar = (t) => Buffer.from(t, 'utf8').toString('base64url');
const descodificar = (s) => Buffer.from(s, 'base64url').toString('utf8');
const mutantesCodificador = {
  'base64 normal (+, / e =)': [(t) => Buffer.from(t, 'utf8').toString('base64'), (s) => Buffer.from(s, 'base64').toString('utf8')],
  'latin1 em vez de utf8': [(t) => Buffer.from(t, 'latin1').toString('base64url'), (s) => Buffer.from(s, 'base64url').toString('latin1')],
  'perde o último carácter': [(t) => codificar(t), (s) => descodificar(s).slice(0, -1) || ''],
};

describe('P1 · propriedades de repartir', () => {
  it('devolve várias propriedades', () => {
    const props = propriedadesRepartir(certo);
    assert.ok(Array.isArray(props) && props.length >= 2);
  });
  it('passam com a implementação certa', () => {
    assert.ok(todasPassam(propriedadesRepartir(certo)));
  });
  for (const [nome, mutante] of Object.entries(mutantesRepartir)) {
    it(`apanham o bug: ${nome}`, () => assert.ok(algumaFalha(propriedadesRepartir(mutante)), 'nenhuma propriedade falhou'));
  }
});

describe('P1 · propriedades do codificador', () => {
  it('passam com a implementação certa', () => {
    assert.ok(todasPassam(propriedadesCodificador(codificar, descodificar)));
  });
  for (const [nome, [c, d]] of Object.entries(mutantesCodificador)) {
    it(`apanham o bug: ${nome}`, () => assert.ok(algumaFalha(propriedadesCodificador(c, d)), 'nenhuma propriedade falhou'));
  }
});
