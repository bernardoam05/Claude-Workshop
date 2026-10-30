import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { comecado, pastaTemporaria, script } from './ajuda.js';

const LOG = `2026-10-29T10:00:00Z INFO arranque
2026-10-29T10:00:01Z ERROR falhou a ligação à BD
2026-10-29T10:00:02Z INFO pedido GET /
2026-10-29T10:00:03Z WARN lento
2026-10-29T10:00:04Z INFO pedido GET /api
2026-10-29T10:00:05Z ERROR timeout
2026-10-29T10:00:06Z WARN memória alta
2026-10-29T10:00:07Z INFO pedido POST /api
2026-10-29T10:00:08Z INFO desligar
`;

function logEm(conteudo) {
  const f = join(pastaTemporaria(), 'app log.txt'); // com um espaço no nome, de propósito
  writeFileSync(f, conteudo);
  return f;
}

describe('P1 · contar-niveis.sh', () => {
  it('conta por nível, do maior para o menor, e empates por ordem alfabética', () => {
    assert.ok(comecado('contar-niveis.sh'), 'ainda não começaste o contar-niveis.sh');
    const r = script('contar-niveis.sh', [logEm(LOG)]);
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.stdout, 'INFO 5\nERROR 2\nWARN 2\n');
  });

  it('funciona com nomes de ficheiro com espaços (aspas!)', () => {
    const r = script('contar-niveis.sh', [logEm('x ERROR a\n')]);
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.stdout, 'ERROR 1\n');
  });

  it('a mensagem pode ter a palavra de outro nível sem a contar', () => {
    const r = script('contar-niveis.sh', [logEm('t INFO houve um ERROR ontem\nt INFO ok\n')]);
    assert.equal(r.stdout, 'INFO 2\n');
  });

  it('sem argumentos: uso no stderr, nada no stdout, código 2', () => {
    for (const args of [[], ['a', 'b']]) {
      const r = script('contar-niveis.sh', args);
      assert.equal(r.codigo, 2, `com ${args.length} argumentos`);
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /uso: contar-niveis\.sh <ficheiro\.log>/);
    }
  });

  it('ficheiro inexistente: mensagem com o nome no stderr e código 1', () => {
    const r = script('contar-niveis.sh', ['/nao/existe.log']);
    assert.equal(r.codigo, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /\/nao\/existe\.log/);
  });
});
