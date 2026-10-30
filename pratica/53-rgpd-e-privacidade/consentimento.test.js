import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { temConsentimento, titularesPara } from './consentimento.js';

const ev = (titular, finalidade, tipo, em, versaoTexto = 1) => ({ titular, finalidade, tipo, em, versaoTexto });
const eventos = [
  ev('ana', 'newsletter', 'retirado', '2026-06-01T00:00:00Z'), // fora de ordem de propósito
  ev('ana', 'newsletter', 'dado', '2026-01-10T00:00:00Z'),
  ev('ana', 'analitica', 'dado', '2026-01-10T00:00:00Z'),
  ev('rui', 'newsletter', 'dado', '2026-03-01T00:00:00Z', 2),
  ev('eva', 'newsletter', 'dado', '2026-02-01T00:00:00Z'),
];

describe('P3 · temConsentimento', () => {
  it('sem eventos não há consentimento', () => {
    assert.equal(temConsentimento([], { titular: 'ana', finalidade: 'newsletter', em: '2026-05-01T00:00:00Z' }), false);
  });
  it('o último evento até essa data decide, mesmo desordenado', () => {
    const q = { titular: 'ana', finalidade: 'newsletter' };
    assert.equal(temConsentimento(eventos, { ...q, em: '2026-01-01T00:00:00Z' }), false);
    assert.equal(temConsentimento(eventos, { ...q, em: '2026-05-01T00:00:00Z' }), true);
    assert.equal(temConsentimento(eventos, { ...q, em: '2026-07-01T00:00:00Z' }), false);
  });
  it('cada finalidade é independente', () => {
    assert.equal(temConsentimento(eventos, { titular: 'ana', finalidade: 'analitica', em: '2026-07-01T00:00:00Z' }), true);
  });
  it('um consentimento a uma versão antiga do texto não vale', () => {
    const q = { finalidade: 'newsletter', em: '2026-05-01T00:00:00Z', versaoMinima: 2 };
    assert.equal(temConsentimento(eventos, { ...q, titular: 'rui' }), true);
    assert.equal(temConsentimento(eventos, { ...q, titular: 'eva' }), false);
  });
});

describe('P3 · titularesPara', () => {
  it('lista quem tem consentimento nesse instante', () => {
    assert.deepEqual(titularesPara(eventos, { finalidade: 'newsletter', em: '2026-05-01T00:00:00Z' }), ['ana', 'eva', 'rui']);
    assert.deepEqual(titularesPara(eventos, { finalidade: 'newsletter', em: '2026-07-01T00:00:00Z' }), ['eva', 'rui']);
    assert.deepEqual(titularesPara(eventos, { finalidade: 'newsletter', em: '2026-07-01T00:00:00Z', versaoMinima: 2 }), ['rui']);
  });
});
