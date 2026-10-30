import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detetarCheiros } from './cheiros.js';

describe('P2 · detetarCheiros', () => {
  it('código limpo não cheira', () => {
    const codigo = [
      'const TAXA_IVA = 0.23;',
      'export function comIva(valor) {',
      '  return valor * (1 + TAXA_IVA);',
      '}',
    ].join('\n');
    assert.deepEqual(detetarCheiros(codigo), []);
  });
  it('demasiados parâmetros', () => {
    const codigo = 'export async function criar(titulo, descricao, prioridade, dono, prazo) {\n  return 0;\n}';
    assert.deepEqual(detetarCheiros(codigo), ['linha 1: função criar com 5 parâmetros']);
  });
  it('funções compridas (conta da linha do function à da chaveta final)', () => {
    const corpo = Array.from({ length: 20 }, (_, i) => `  passo${i}();`);
    const codigo = ['function longa() {', ...corpo, '}', 'function curta() { return 1; }'].join('\n');
    assert.deepEqual(detetarCheiros(codigo), ['linha 1: função longa com 22 linhas']);
    assert.deepEqual(detetarCheiros(codigo, { maxLinhas: 22 }), []);
  });
  it('aninhamento demasiado fundo', () => {
    const codigo = [
      'function f(lista) {',
      '  for (const x of lista) {',
      '    if (x) {',
      '      if (x.ok) {',
      '        if (x.feito) { g(); }',
      '      }',
      '    }',
      '  }',
      '}',
    ].join('\n');
    assert.deepEqual(detetarCheiros(codigo), ['linha 4: aninhamento de profundidade 4', 'linha 5: aninhamento de profundidade 5']);
    assert.deepEqual(detetarCheiros(codigo, { maxProfundidade: 4 }), ['linha 5: aninhamento de profundidade 5']);
  });
  it('números mágicos (0 e 1 não contam, nem as constantes com nome, nem os comentários)', () => {
    const codigo = [
      'const LIMITE = 50; // 50 euros',
      'function portes(total) {',
      '  if (total < 50) return total + 4.99; // portes 2026',
      '  return total * 1 + 0;',
      '}',
    ].join('\n');
    assert.deepEqual(detetarCheiros(codigo), ['linha 3: número mágico 50', 'linha 3: número mágico 4.99']);
  });
  it('não confunde números dentro de nomes', () => {
    assert.deepEqual(detetarCheiros('function f(x2) {\n  return md5(x2);\n}'), []);
  });
  it('junta tudo, ordenado por linha', () => {
    const codigo = 'function f(a, b, c, d) {\n  return a * 60;\n}';
    assert.deepEqual(detetarCheiros(codigo), ['linha 1: função f com 4 parâmetros', 'linha 2: número mágico 60']);
  });
});
