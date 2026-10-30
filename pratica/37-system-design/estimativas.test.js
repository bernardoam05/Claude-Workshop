import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { armazenamento, formatarBytes, pedidosPorSegundo } from './estimativas.js';

describe('P1 · estimativas', () => {
  it('pedidos por segundo: média e pico, arredondados para cima', () => {
    // 10 milhões de utilizadores por dia, 20 pedidos cada: 200 M / 86 400 s = 2314,8 → 2315
    assert.deepEqual(pedidosPorSegundo({ utilizadoresDiarios: 10_000_000, pedidosPorUtilizador: 20, fatorPico: 3 }), { media: 2315, pico: 6945 });
    assert.deepEqual(pedidosPorSegundo({ utilizadoresDiarios: 86_400, pedidosPorUtilizador: 1 }), { media: 1, pico: 1 });
  });

  it('armazenamento ao fim de N anos, com réplicas', () => {
    // 1 milhão de URLs por dia, 500 bytes cada, 5 anos, 3 réplicas
    assert.equal(armazenamento({ itensPorDia: 1_000_000, bytesPorItem: 500, anos: 5, replicas: 3 }), 2_737_500_000_000);
    assert.equal(armazenamento({ itensPorDia: 10, bytesPorItem: 100, anos: 1 }), 365_000);
  });

  it('formatar bytes de forma legível', () => {
    assert.equal(formatarBytes(512), '512 B');
    assert.equal(formatarBytes(1500), '1.5 KB');
    assert.equal(formatarBytes(2_000_000), '2 MB');
    assert.equal(formatarBytes(999_999), '1000 KB');
    assert.equal(formatarBytes(2_737_500_000_000), '2.7 TB');
    assert.equal(formatarBytes(3.25e12), '3.3 TB');
    assert.equal(formatarBytes(7e15), '7 PB');
    assert.equal(formatarBytes(0), '0 B');
  });
});
