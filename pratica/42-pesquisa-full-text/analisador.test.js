import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizar, radical, tokenizar } from './analisador.js';

describe('P1 · normalizar', () => {
  it('minúsculas e sem acentos', () => {
    assert.equal(normalizar('Ações à Pressão, Já!'), 'acoes a pressao, ja!');
  });
});

describe('P1 · radical', () => {
  for (const [entrada, saida] of [
    ['acoes', 'acao'], ['manuais', 'manual'], ['flores', 'flor'], ['vezes', 'vez'],
    ['tarefas', 'tarefa'], ['mas', 'mas'], ['urgente', 'urgente'], ['meses', 'mes'],
  ]) {
    it(`${entrada} → ${saida}`, () => assert.equal(radical(entrada), saida));
  }
});

describe('P1 · tokenizar', () => {
  it('normaliza, parte, tira palavras vazias e reduz', () => {
    assert.deepEqual(tokenizar('As Ações urgentes da equipa: rever 3 manuais!'), ['acao', 'urgente', 'equipa', 'rever', '3', 'manual']);
  });
  it('texto vazio dá []', () => {
    assert.deepEqual(tokenizar('  ... '), []);
  });
});
