import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { afirmarTexto, idTarefa, type ChavesDoTipo, type Endpoint, type IdTarefa, type ParcialProfundo, type Rota } from './tiposAvancados.js';
import { esperar, type Igual } from './testesDeTipos.js';

type Config = { bd: { url: string; pool: { min: number; max: number } }; portas: number[]; nome: string };

function tipos(): void {
  const parcial: ParcialProfundo<Config> = { bd: { pool: { max: 5 } } }; // tudo opcional, a todos os níveis
  const vazio: ParcialProfundo<Config> = {};
  // @ts-expect-error: opcional não quer dizer qualquer tipo
  const errado: ParcialProfundo<Config> = { bd: { pool: { max: 'cinco' } } };
  esperar<Igual<NonNullable<ParcialProfundo<Config>['portas']>, number[]>>(); // os arrays ficam como estão

  esperar<Igual<ChavesDoTipo<{ id: number; titulo: string; nota: string; feita: boolean }, string>, 'titulo' | 'nota'>>();
  esperar<Igual<ChavesDoTipo<{ id: number }, string>, never>>();

  const r: Rota = '/api/tarefas';
  // @ts-expect-error: não começa por /api/
  const r2: Rota = '/tarefas';
  const ep: Endpoint = 'GET /api/tarefas/42';
  // @ts-expect-error: FETCH não é um método
  const ep2: Endpoint = 'FETCH /api/tarefas';
  // @ts-expect-error: falta o espaço
  const ep3: Endpoint = 'GET/api/tarefas';

  const id = idTarefa(7);
  esperar<Igual<typeof id, IdTarefa>>();
  const n: number = id; // um IdTarefa continua a ser um número...
  // @ts-expect-error: ...mas um número qualquer NÃO é um IdTarefa
  const naoPode: IdTarefa = 7;

  const x: unknown = JSON.parse('"olá"');
  afirmarTexto(x);
  esperar<Igual<typeof x, string>>(); // depois da asserção, o compilador sabe
  void [parcial, vazio, errado, r, r2, ep, ep2, ep3, n, naoPode];
}
void tipos;

describe('P3 · em tempo de execução', () => {
  it('idTarefa valida', () => {
    assert.equal(idTarefa(7), 7);
    for (const n of [0, -1, 1.5, Number.NaN]) assert.throws(() => idTarefa(n), String(n));
  });

  it('afirmarTexto lança se não for texto', () => {
    assert.doesNotThrow(() => afirmarTexto('a'));
    for (const v of [1, null, undefined, {}, ['a']]) assert.throws(() => afirmarTexto(v));
  });
});
