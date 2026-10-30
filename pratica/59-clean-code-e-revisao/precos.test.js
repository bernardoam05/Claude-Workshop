import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { calc } from './precosLegado.js';
import { DESCONTO_VIP, MINIMO_SEM_PORTES, PORTES, descontoPorQuantidade, taxaIva, totalEncomenda, totalLinha } from './precos.js';

describe('P1 · as peças extraídas', () => {
  it('constantes com nome', () => {
    assert.deepEqual([DESCONTO_VIP, PORTES, MINIMO_SEM_PORTES], [0.1, 4.99, 50]);
  });
  it('desconto por quantidade, com os limites', () => {
    assert.deepEqual([1, 9, 10, 49, 50, 500].map(descontoPorQuantidade), [0, 0, 0.05, 0.05, 0.15, 0.15]);
  });
  it('taxa de IVA', () => {
    assert.deepEqual(['livro', 'comida', 'roupa', undefined].map(taxaIva), [0.06, 0.13, 0.23, 0.23]);
  });
  it('total de uma linha', () => {
    assert.ok(Math.abs(totalLinha({ preco: 10, quantidade: 10, categoria: 'livro' }) - 100.7) < 1e-9);
  });
});

describe('P1 · testes de caracterização: o mesmo que o código antigo', () => {
  const linha = fc.record({
    preco: fc.integer({ min: 1, max: 20_000 }).map((c) => c / 100),
    quantidade: fc.integer({ min: 1, max: 120 }),
    categoria: fc.constantFrom('livro', 'comida', 'roupa', 'eletronica'),
  });
  const cliente = fc.option(fc.record({ vip: fc.boolean() }), { nil: undefined });
  const paraAntigo = (ls) => ls.map((l) => ({ p: l.preco, q: l.quantidade, cat: l.categoria }));

  it('casos escolhidos à mão (os limites)', () => {
    const casos = [
      [[], undefined],
      [[{ preco: 45.87, quantidade: 1, categoria: 'roupa' }], undefined], // mesmo abaixo dos 50
      [[{ preco: 47.17, quantidade: 1, categoria: 'livro' }], { vip: true }],
      [[{ preco: 1, quantidade: 50, categoria: 'comida' }, { preco: 2.5, quantidade: 10, categoria: 'livro' }], { vip: false }],
    ];
    for (const [ls, c] of casos) assert.equal(totalEncomenda(ls, c), calc(paraAntigo(ls), c), JSON.stringify([ls, c]));
  });
  it('centenas de encomendas aleatórias (tolerância de 1 cêntimo, por causa da vírgula flutuante)', () => {
    fc.assert(
      fc.property(fc.array(linha, { maxLength: 6 }), cliente, (ls, c) => Math.abs(totalEncomenda(ls, c) - calc(paraAntigo(ls), c)) <= 0.0100001),
      { numRuns: 1000, seed: 7 },
    );
  });
});
