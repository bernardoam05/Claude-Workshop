import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArmazemDeEventos, ProjecaoSaldos, abrir, aplicar, depositar, executar, fechar, levantar, reconstruir } from './eventos.js';

const HISTORIA = [
  { tipo: 'ContaAberta', contaId: 'c1', titular: 'Ana' },
  { tipo: 'Depositado', contaId: 'c1', valor: 100 },
  { tipo: 'Levantado', contaId: 'c1', valor: 30 },
];

describe('P2 · reconstruir o estado a partir dos eventos', () => {
  it('aplica os eventos por ordem', () => {
    assert.deepEqual(reconstruir(HISTORIA), { contaId: 'c1', titular: 'Ana', saldo: 70, aberta: true });
    assert.equal(reconstruir([]), null);
  });

  it('aplicar é pura', () => {
    const antes = Object.freeze({ contaId: 'c1', titular: 'Ana', saldo: 10, aberta: true });
    const depois = aplicar(antes, { tipo: 'Depositado', contaId: 'c1', valor: 5 });
    assert.equal(depois.saldo, 15);
    assert.equal(antes.saldo, 10);
  });
});

describe('P2 · comandos', () => {
  it('decidem os eventos a partir do estado, sem mudar nada', () => {
    const estado = reconstruir(HISTORIA);
    assert.deepEqual(depositar(estado, 50), [{ tipo: 'Depositado', contaId: 'c1', valor: 50 }]);
    assert.deepEqual(levantar(estado, 70), [{ tipo: 'Levantado', contaId: 'c1', valor: 70 }]);
    assert.deepEqual(abrir(null, 'c2', 'Bruno'), [{ tipo: 'ContaAberta', contaId: 'c2', titular: 'Bruno' }]);
    assert.equal(estado.saldo, 70);
  });

  it('recusam o que é inválido', () => {
    const estado = reconstruir(HISTORIA);
    assert.throws(() => levantar(estado, 71), /saldo/);
    assert.throws(() => depositar(estado, 0));
    assert.throws(() => abrir(estado, 'c1', 'Ana'), Error, 'já está aberta');
    assert.throws(() => fechar(estado), Error, 'tem saldo');
    assert.throws(() => depositar(null, 10), Error, 'não está aberta');
    const fechada = reconstruir([...HISTORIA, { tipo: 'Levantado', contaId: 'c1', valor: 70 }, { tipo: 'ContaFechada', contaId: 'c1' }]);
    assert.equal(fechada.aberta, false);
    assert.throws(() => depositar(fechada, 10));
  });
});

describe('P2 · armazém de eventos', () => {
  it('acrescenta com versões e lê por stream', () => {
    const a = new ArmazemDeEventos();
    a.acrescentar('c1', HISTORIA.slice(0, 2), 0);
    a.acrescentar('c1', HISTORIA.slice(2), 2);
    assert.deepEqual(a.ler('c1').map((e) => e.versao), [1, 2, 3]);
    assert.deepEqual(a.ler('outra'), []);
  });

  it('dois a escrever com a mesma versão lida: o segundo falha (concorrência)', () => {
    const a = new ArmazemDeEventos();
    a.acrescentar('c1', HISTORIA, 0);
    a.acrescentar('c1', [{ tipo: 'Depositado', contaId: 'c1', valor: 1 }], 3);
    assert.throws(() => a.acrescentar('c1', [{ tipo: 'Levantado', contaId: 'c1', valor: 70 }], 3), /concorrência/);
    assert.equal(a.ler('c1').length, 4);
  });

  it('executar: o ciclo ler → decidir → gravar', () => {
    const a = new ArmazemDeEventos();
    executar(a, 'c1', abrir, 'c1', 'Ana');
    executar(a, 'c1', depositar, 100);
    const estado = executar(a, 'c1', levantar, 40);
    assert.equal(estado.saldo, 60);
    assert.deepEqual(a.ler('c1').map((e) => e.tipo), ['ContaAberta', 'Depositado', 'Levantado']);
    assert.throws(() => executar(a, 'c1', levantar, 1000), /saldo/);
    assert.equal(a.ler('c1').length, 3, 'um comando recusado não grava nada');
  });
});

describe('P2 · projeção (CQRS)', () => {
  it('soma as contas de cada titular, incluindo o que já existia e o que chega depois', () => {
    const a = new ArmazemDeEventos();
    executar(a, 'c1', abrir, 'c1', 'Ana');
    executar(a, 'c1', depositar, 100);
    const p = new ProjecaoSaldos(a);
    assert.equal(p.saldoDe('Ana'), 100);
    executar(a, 'c2', abrir, 'c2', 'Ana');
    executar(a, 'c2', depositar, 50);
    executar(a, 'c3', abrir, 'c3', 'Bruno');
    executar(a, 'c3', depositar, 7);
    executar(a, 'c1', levantar, 100);
    executar(a, 'c1', fechar);
    assert.equal(p.saldoDe('Ana'), 50);
    assert.equal(p.saldoDe('Bruno'), 7);
    assert.equal(p.saldoDe('Carla'), 0);
    assert.deepEqual(a.todos().map((e) => e.contaId), ['c1', 'c1', 'c2', 'c2', 'c3', 'c3', 'c1', 'c1']);
  });
});
