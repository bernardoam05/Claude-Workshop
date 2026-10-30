import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { EsquemaTarefaExterna, LIMITES, lerTarefas, resumir, type Etiqueta, type Tarefa } from './migrado.js';
import { esperar, type Igual } from './testesDeTipos.js';

function tipos(): void {
  esperar<Igual<Tarefa, { id: number; titulo: string; feita: boolean; etiquetas: string[] }>>();
  esperar<Igual<Tarefa, z.output<typeof EsquemaTarefaExterna>>>(); // inferido do esquema, não escrito à mão
  esperar<Igual<Etiqueta, 'casa' | 'trabalho' | 'estudo'>>();
  esperar<Igual<typeof LIMITES.maxTitulo, 200>>(); // o tipo exato (literal), graças ao as const
  // @ts-expect-error: é readonly (as const)
  LIMITES.etiquetasPermitidas.push('lazer');
  const r = resumir([]);
  esperar<Igual<typeof r, { total: number; feitas: number; porEtiqueta: Record<string, number> }>>();
}
void tipos;

const JSON_OK = JSON.stringify([
  { id: 1, title: 'Pão', done: true, tags: ['casa'] },
  { id: 2, title: 'Relatório', done: false, tags: ['trabalho', 'casa'] },
  { id: 3, title: 'Ler', done: false },
]);

describe('P4 · lerTarefas', () => {
  it('converte da forma de fora para a de dentro', () => {
    assert.deepEqual(lerTarefas(JSON_OK), [
      { id: 1, titulo: 'Pão', feita: true, etiquetas: ['casa'] },
      { id: 2, titulo: 'Relatório', feita: false, etiquetas: ['trabalho', 'casa'] },
      { id: 3, titulo: 'Ler', feita: false, etiquetas: [] },
    ]);
  });

  it('recusa o que não cumpre o esquema (em vez de deixar passar undefined, como o legado)', () => {
    for (const mau of ['isto não é json', '{"id":1}', '[{"id":1,"title":"x"}]', '[{"id":-1,"title":"x","done":false}]', '[{"id":1,"title":"","done":false}]']) {
      assert.throws(() => lerTarefas(mau), Error, mau);
    }
  });
});

describe('P4 · resumir (os dois bugs do legado, corrigidos)', () => {
  it('conta as feitas e as etiquetas', () => {
    assert.deepEqual(resumir(lerTarefas(JSON_OK)), { total: 3, feitas: 1, porEtiqueta: { casa: 2, trabalho: 1 } });
  });

  it('o legado, com os mesmos dados, dá lixo (é por isso que os tipos importam)', async () => {
    // @ts-expect-error: o legado.js não tem tipos
    const legado = await import('./legado.js');
    assert.throws(() => legado.resumir(legado.lerTarefas(JSON_OK)), TypeError, 't.etiqueta não existe: rebenta com um TypeError');
  });
});

describe('P4 · LIMITES', () => {
  it('os valores', () => {
    assert.equal(LIMITES.maxTitulo, 200);
    assert.deepEqual([...LIMITES.etiquetasPermitidas], ['casa', 'trabalho', 'estudo']);
  });
});
