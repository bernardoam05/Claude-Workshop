import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Conta, criarContador, lerConfig, SaldoInsuficiente } from './classes.js';

describe('P4 · criarContador (closure)', () => {
  it('incrementa, decrementa e nunca desce abaixo de 0', () => {
    const c = criarContador(1);
    assert.equal(c.incrementar(), 2);
    assert.equal(c.decrementar(), 1);
    assert.equal(c.decrementar(), 0);
    assert.equal(c.decrementar(), 0);
    assert.equal(c.valor(), 0);
  });

  it('cada contador tem o seu estado, e o número não está acessível por fora', () => {
    const a = criarContador();
    const b = criarContador(10);
    a.incrementar();
    assert.equal(a.valor(), 1);
    assert.equal(b.valor(), 10);
    assert.deepEqual(Object.keys(a).sort(), ['decrementar', 'incrementar', 'valor']);
  });
});

describe('P4 · Conta (classe com campo privado, getter, estático e erros)', () => {
  it('depositar e levantar, encadeados', () => {
    const conta = new Conta('Ana').depositar(100).levantar(30);
    assert.equal(conta.titular, 'Ana');
    assert.equal(conta.saldo, 70);
  });

  it('o saldo é privado e só de leitura', () => {
    const conta = new Conta('Ana').depositar(10);
    assert.deepEqual(Object.keys(conta), ['titular'], 'o saldo vive num campo #privado');
    assert.throws(() => {
      conta.saldo = 1_000_000;
    }, TypeError);
  });

  it('depósitos não positivos dão RangeError', () => {
    assert.throws(() => new Conta('Ana').depositar(0), RangeError);
    assert.throws(() => new Conta('Ana').depositar(-5), RangeError);
  });

  it('levantar sem saldo dá SaldoInsuficiente, com o valor em falta, e o saldo não muda', () => {
    const conta = new Conta('Ana').depositar(20);
    assert.throws(
      () => conta.levantar(50),
      (err) => err instanceof SaldoInsuficiente && err instanceof Error && err.emFalta === 30,
    );
    assert.equal(conta.saldo, 20);
  });

  it('Conta.transferir (estático) é tudo ou nada', () => {
    const ana = new Conta('Ana').depositar(50);
    const bruno = new Conta('Bruno');
    Conta.transferir(ana, bruno, 20);
    assert.deepEqual([ana.saldo, bruno.saldo], [30, 20]);

    assert.throws(() => Conta.transferir(ana, bruno, 100), SaldoInsuficiente);
    assert.deepEqual([ana.saldo, bruno.saldo], [30, 20], 'uma transferência falhada não muda nenhuma das contas');
  });
});

describe('P4 · lerConfig (try / catch / finally)', () => {
  it('JSON válido e inválido, e o finally corre sempre', () => {
    let chamadas = 0;
    const contar = () => chamadas++;
    assert.deepEqual(lerConfig('{"porta": 3000}', contar), { ok: true, valor: { porta: 3000 } });
    assert.deepEqual(lerConfig('{porta: 3000}', contar), { ok: false, erro: 'JSON inválido' });
    assert.equal(chamadas, 2);
  });
});
