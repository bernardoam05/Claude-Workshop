import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { describe, it } from 'node:test';
import { somarPorCategoria, transformarLinhas } from './fluxos.js';

// Um Readable que entrega o texto em pedaços de tamanho fixo (partindo linhas a meio).
const emPedacos = (texto, tamanho) => Readable.from((function* () {
  for (let i = 0; i < texto.length; i += tamanho) yield texto.slice(i, i + tamanho);
})());

describe('P2 · somarPorCategoria', () => {
  it('soma por categoria, com linhas partidas entre pedaços', async () => {
    const csv = 'categoria,valor\ncomida,12.5\ntransporte,3\ncomida,7.5\n\nlivros,20\ntransporte,1.25';
    for (const t of [1, 3, 7, 1000]) {
      assert.deepEqual(await somarPorCategoria(emPedacos(csv, t)), { comida: 20, transporte: 4.25, livros: 20 }, `pedaços de ${t}`);
    }
  });
  it('aguenta um ficheiro grande gerado aos bocados', async () => {
    const n = 200_000;
    const gerado = Readable.from((function* () {
      yield 'categoria,valor\n';
      for (let i = 0; i < n; i++) yield `c${i % 3},1\n`;
    })());
    const r = await somarPorCategoria(gerado);
    assert.equal(r.c0 + r.c1 + r.c2, n);
  });
});

describe('P2 · transformarLinhas', () => {
  // Um destino lento (1 ms por escrita, buffer pequeno) que regista o maior buffer pendente.
  function destinoLento() {
    const linhas = [];
    let maior = 0;
    const w = new Writable({
      highWaterMark: 1024,
      write(pedaco, _cod, feito) {
        maior = Math.max(maior, w.writableLength);
        linhas.push(pedaco.toString());
        setTimeout(feito, 1);
      },
    });
    return { w, linhas, maior: () => maior };
  }
  it('transforma cada linha, incluindo a última sem \\n', async () => {
    const d = destinoLento();
    await transformarLinhas(emPedacos('ab\ncde\nf', 2), d.w, (l) => l.toUpperCase());
    assert.equal(d.linhas.join(''), 'AB\nCDE\nF\n');
  });
  it('respeita a backpressure: com uma origem rápida e um destino lento, nada se acumula', async () => {
    const d = destinoLento();
    const origem = Readable.from((function* () {
      for (let i = 0; i < 300; i++) yield `${'x'.repeat(200)}\n`;
    })());
    await transformarLinhas(origem, d.w, (l) => l);
    assert.equal(d.linhas.join('').length, 300 * 201);
    assert.ok(d.maior() < 4096, `o destino chegou a ter ${d.maior()} bytes à espera`);
  });
  it('um erro na transformação rejeita e fecha os streams', async () => {
    const d = destinoLento();
    const origem = emPedacos('1\n2\nrebenta\n4\n', 3);
    await assert.rejects(transformarLinhas(origem, d.w, (l) => {
      if (l === 'rebenta') throw new Error('linha inválida');
      return l;
    }), /linha inválida/);
    assert.ok(origem.destroyed);
  });
});
