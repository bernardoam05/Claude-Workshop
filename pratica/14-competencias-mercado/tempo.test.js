import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { debounce, throttle } from './tempo.js';

// t.mock.timers substitui o setTimeout por um relógio falso: t.mock.timers.tick(100) faz
// "passar" 100 ms instantaneamente. Os testes de tempo ficam rápidos e sem surpresas.

describe('P1 · debounce', () => {
  it('várias chamadas seguidas → uma só execução, ms depois da última, com os últimos argumentos', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fn = t.mock.fn();
    const pesquisar = debounce(fn, 300);

    pesquisar('d');
    t.mock.timers.tick(100);
    pesquisar('do');
    t.mock.timers.tick(100);
    pesquisar('doc');
    t.mock.timers.tick(299);
    assert.equal(fn.mock.callCount(), 0, 'ainda não passaram 300 ms desde a última chamada');

    t.mock.timers.tick(1);
    assert.equal(fn.mock.callCount(), 1);
    assert.deepEqual(fn.mock.calls[0].arguments, ['doc']);
  });

  it('chamadas separadas por mais de ms → uma execução cada', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fn = t.mock.fn();
    const d = debounce(fn, 50);
    d(1);
    t.mock.timers.tick(60);
    d(2);
    t.mock.timers.tick(60);
    assert.deepEqual(fn.mock.calls.map((c) => c.arguments[0]), [1, 2]);
  });

  it('mantém o this de quem chama', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const obj = {
      nome: 'campo',
      guardar: debounce(function () {
        obj.visto = this.nome;
      }, 10),
    };
    obj.guardar();
    t.mock.timers.tick(10);
    assert.equal(obj.visto, 'campo');
  });
});

describe('P1 · throttle', () => {
  it('executa logo na 1.ª chamada e ignora as seguintes durante ms', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const fn = t.mock.fn();
    const aoScroll = throttle(fn, 100);

    aoScroll('a');
    assert.equal(fn.mock.callCount(), 1, 'a primeira chamada executa imediatamente');
    aoScroll('b');
    t.mock.timers.tick(50);
    aoScroll('c');
    assert.equal(fn.mock.callCount(), 1, 'dentro dos 100 ms, ignora');

    t.mock.timers.tick(50);
    aoScroll('d');
    assert.deepEqual(fn.mock.calls.map((c) => c.arguments[0]), ['a', 'd'], 'passados 100 ms, volta a executar logo');
  });

  it('mantém o this e os argumentos', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const obj = {
      n: 0,
      somar: throttle(function (x) {
        this.n += x;
      }, 10),
    };
    obj.somar(5);
    assert.equal(obj.n, 5);
  });
});
