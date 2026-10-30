import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estadoSeguinteLegado } from './maquinaLegado.js';
import { TRANSICOES, acoesPossiveis, alcancaveis, seguinte } from './maquina.js';

const ESTADOS = ['rascunho', 'aberta', 'em_curso', 'bloqueada', 'feita', 'cancelada', 'inexistente', 'toString'];
const ACOES = ['publicar', 'comecar', 'bloquear', 'desbloquear', 'concluir', 'cancelar', 'reabrir', 'voar', 'constructor'];
const resultado = (f) => {
  try {
    return { ok: f() };
  } catch (e) {
    return { erro: e.message };
  }
};

describe('P4 · a tabela faz o mesmo que o switch', () => {
  it('em TODAS as combinações de estado e ação (incluindo as inválidas)', () => {
    for (const e of ESTADOS) {
      for (const a of ACOES) {
        assert.deepEqual(resultado(() => seguinte(e, a)), resultado(() => estadoSeguinteLegado(e, a)), `${e} + ${a}`);
      }
    }
  });
  it('a tabela é dados simples', () => {
    assert.equal(TRANSICOES.em_curso.concluir, 'feita');
    assert.equal(Object.keys(TRANSICOES).length, 6);
  });
});

describe('P4 · o que a tabela dá de graça', () => {
  it('acoesPossiveis', () => {
    assert.deepEqual(acoesPossiveis('em_curso'), ['bloquear', 'cancelar', 'concluir']);
    assert.deepEqual(acoesPossiveis('feita'), ['reabrir']);
    assert.deepEqual(acoesPossiveis('toString'), []);
  });
  it('alcancaveis', () => {
    assert.deepEqual(alcancaveis('rascunho'), ['aberta', 'bloqueada', 'cancelada', 'em_curso', 'feita', 'rascunho']);
    assert.deepEqual(alcancaveis('feita'), ['aberta', 'bloqueada', 'cancelada', 'em_curso', 'feita'], 'o rascunho não volta');
    assert.deepEqual(alcancaveis('inexistente'), ['inexistente']);
  });
});
