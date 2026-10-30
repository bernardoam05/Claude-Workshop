import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarBarramento, memoizar } from './fugas.js';

describe('P3 · barramento sem fugas', () => {
  it('subscrever, emitir e cancelar', () => {
    const b = criarBarramento();
    const recebidos = [];
    const cancelar = b.subscrever('tarefa:criada', (d) => recebidos.push(['a', d]));
    b.subscrever('tarefa:criada', (d) => recebidos.push(['b', d]));
    b.emitir('tarefa:criada', 1);
    cancelar();
    cancelar();
    b.emitir('tarefa:criada', 2);
    assert.deepEqual(recebidos, [['a', 1], ['b', 1], ['b', 2]]);
    assert.equal(b.subscritores('tarefa:criada'), 1);
  });
  it('a mesma função subscrita duas vezes conta duas vezes, e cancela-se uma de cada vez', () => {
    const b = criarBarramento();
    let n = 0;
    const fn = () => n++;
    const c1 = b.subscrever('x', fn);
    b.subscrever('x', fn);
    b.emitir('x');
    c1();
    b.emitir('x');
    assert.equal(n, 3);
  });
  it('10 000 pedidos que subscrevem e cancelam não deixam nada para trás', () => {
    const b = criarBarramento();
    for (let i = 0; i < 10_000; i++) {
      const cancelar = b.subscrever(`tarefa:${i}`, () => {});
      b.emitir(`tarefa:${i}`, i);
      cancelar();
    }
    assert.equal(b.eventos, 0);
  });
  it('cancelar durante a emissão não salta os outros', () => {
    const b = criarBarramento();
    const chamados = [];
    let cancelarA;
    cancelarA = b.subscrever('e', () => {
      chamados.push('a');
      cancelarA();
    });
    b.subscrever('e', () => chamados.push('b'));
    b.emitir('e');
    b.emitir('e');
    assert.deepEqual(chamados, ['a', 'b', 'b']);
  });
});

describe('P3 · memoizar com limite', () => {
  it('não volta a calcular, e nunca passa do máximo', () => {
    let calculos = 0;
    const quadrado = memoizar((x) => (calculos++, x * x), { max: 3 });
    assert.equal(quadrado(2), 4);
    assert.equal(quadrado(2), 4);
    assert.equal(calculos, 1);
    for (let i = 0; i < 1000; i++) quadrado(i);
    assert.equal(quadrado.tamanho, 3);
  });
  it('sai o usado há mais tempo', () => {
    let calculos = 0;
    const f = memoizar((x) => (calculos++, x), { max: 2 });
    f('a');
    f('b');
    f('a'); // 'a' passa a ser o mais recente
    f('c'); // sai o 'b'
    calculos = 0;
    f('a');
    f('c');
    assert.equal(calculos, 0);
    f('b');
    assert.equal(calculos, 1);
  });
});
