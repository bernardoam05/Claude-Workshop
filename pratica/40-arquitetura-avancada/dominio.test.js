import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Dinheiro, Encomenda } from './dominio.js';

const eur = (c) => new Dinheiro(c);

describe('P1 · Dinheiro (objeto de valor)', () => {
  it('soma e multiplica sem erros de vírgula flutuante', () => {
    assert.equal(eur(10).somar(eur(20)).toString(), '0.30 EUR', '0,10 + 0,20 tem de dar 0,30 (com números de vírgula daria 0.30000000000000004)');
    assert.equal(eur(1234).multiplicar(3).toString(), '37.02 EUR');
    assert.equal(new Dinheiro(5, 'USD').toString(), '0.05 USD');
  });

  it('é imutável e compara por valor', () => {
    const a = eur(100);
    a.somar(eur(1));
    assert.equal(a.toString(), '1.00 EUR', 'somar devolve um Dinheiro novo');
    assert.ok(Object.isFrozen(a));
    assert.ok(eur(100).igual(eur(100)));
    assert.ok(!eur(100).igual(new Dinheiro(100, 'USD')));
  });

  it('recusa o que não faz sentido', () => {
    assert.equal(eur(1).toString(), '0.01 EUR');
    assert.throws(() => eur(1.5));
    assert.throws(() => eur(1).somar(new Dinheiro(1, 'USD')));
    assert.throws(() => eur(1).multiplicar(0.5));
  });
});

describe('P1 · Encomenda (agregado)', () => {
  it('soma as linhas, e o mesmo produto acumula', () => {
    const e = new Encomenda('E1', 'C1');
    e.adicionarLinha('pao', 2, eur(120));
    e.adicionarLinha('leite', 1, eur(95));
    e.adicionarLinha('pao', 1, eur(120));
    assert.equal(e.linhas.length, 2);
    assert.equal(e.linhas.find((l) => l.produtoId === 'pao').quantidade, 3);
    assert.equal(e.total.toString(), '4.55 EUR');
    assert.equal(new Encomenda('E2', 'C1').total.toString(), '0.00 EUR');
  });

  it('quem está de fora não consegue mexer nas linhas', () => {
    const e = new Encomenda('E1', 'C1');
    e.adicionarLinha('pao', 1, eur(100));
    e.linhas.push({ produtoId: 'batota', quantidade: 99, precoUnitario: eur(1) });
    e.linhas[0].quantidade = 1000;
    assert.equal(e.total.toString(), '1.00 EUR');
  });

  it('protege as invariantes', () => {
    const e = new Encomenda('E1', 'C1');
    assert.throws(() => e.adicionarLinha('x', 0, eur(1)));
    assert.throws(() => e.adicionarLinha('x', 1.5, eur(1)));
    for (let i = 0; i < 10; i++) e.adicionarLinha(`p${i}`, 1, eur(1));
    assert.throws(() => e.adicionarLinha('p10', 1, eur(1)), /10/);
    assert.throws(() => new Encomenda('E3', 'C1').confirmar(), Error, 'uma encomenda vazia não pode ser confirmada');
  });

  it('confirmar regista um evento de domínio; depois de confirmada, já não se mexe', () => {
    const e = new Encomenda('E1', 'C1');
    e.adicionarLinha('pao', 2, eur(120));
    e.confirmar();
    assert.equal(e.estado, 'confirmada');
    assert.deepEqual(e.retirarEventos(), [{ tipo: 'EncomendaConfirmada', encomendaId: 'E1', clienteId: 'C1', total: '2.40 EUR' }]);
    assert.deepEqual(e.retirarEventos(), [], 'retirar esvazia a lista');
    assert.throws(() => e.adicionarLinha('leite', 1, eur(1)), /rascunho/);
    assert.throws(() => e.confirmar());
  });

  it('cancelar', () => {
    const e = new Encomenda('E1', 'C1');
    e.adicionarLinha('pao', 1, eur(1));
    e.confirmar();
    e.cancelar();
    assert.equal(e.estado, 'cancelada');
    assert.deepEqual(e.retirarEventos().map((x) => x.tipo), ['EncomendaConfirmada', 'EncomendaCancelada']);
    assert.throws(() => e.cancelar());
  });
});
