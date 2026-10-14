import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import kafkajs from 'kafkajs';
import { murmur2, particao } from './particionador.js';

describe('P1 · murmur2', () => {
  // Valores dos testes do próprio Kafka (UtilsTest.testMurmur2, em Java). Se o teu hash der isto,
  // dá o mesmo que qualquer produtor Kafka do mundo.
  const vetores = {
    21: -973932308,
    foobar: -790332482,
    'a-little-bit-long-string': -985981536,
    'a-little-bit-longer-string': -1486304829,
    lkjh234lh9fiuh90y23oiuhsafujhadof229phr9h19h89h8: -58897971,
    abc: 479470107,
  };
  for (const [chave, esperado] of Object.entries(vetores)) {
    it(`murmur2("${chave}") = ${esperado}`, () => {
      assert.equal(murmur2(chave), esperado);
    });
  }

  it('usa os bytes UTF-8 (uma chave com acentos tem mais bytes do que caracteres)', () => {
    // 'ç' e 'ã' ocupam 2 bytes cada em UTF-8: "ação" são 6 bytes, não 4. Valor confirmado com o kafkajs.
    assert.equal(murmur2('ação'), 1010978653);
  });
});

describe('P1 · particao', () => {
  it('dá a mesma partição que o kafkajs (o produtor do projeto), para 300 chaves', () => {
    for (const n of [3, 7]) {
      const kafkaPartitioner = kafkajs.Partitioners.DefaultPartitioner();
      const metadata = Array.from({ length: n }, (_, partitionId) => ({ partitionId, leader: 1 }));
      for (let i = 0; i < 150; i++) {
        const chave = i % 3 === 0 ? `utilizador-${i}-ação` : String(i);
        const esperado = kafkaPartitioner({ topic: 'task-events', partitionMetadata: metadata, message: { key: chave } });
        assert.equal(particao(chave, n), esperado, `chave "${chave}" com ${n} partições`);
      }
    }
  });

  it('a mesma chave vai SEMPRE para a mesma partição (é isso que garante a ordem por utilizador)', () => {
    assert.equal(particao('42', 3), particao('42', 3));
  });

  it('nunca devolve uma partição negativa (o hash pode ser negativo)', () => {
    assert.equal(murmur2('21') < 0, true, 'este hash é negativo...');
    assert.ok(particao('21', 3) >= 0, '...mas a partição não pode ser');
  });
});
