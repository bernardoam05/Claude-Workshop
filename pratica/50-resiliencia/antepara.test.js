import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErroSobrecarga, criarAntepara } from './antepara.js';

// Uma tarefa que só acaba quando a mandamos acabar.
function controlada() {
  let acabar;
  let falhar;
  const p = new Promise((resolve, reject) => {
    acabar = resolve;
    falhar = reject;
  });
  return { fn: () => p, acabar, falhar };
}
const tique = () => new Promise((r) => setImmediate(r));

describe('P3 · antepara', () => {
  it('corre até N ao mesmo tempo, põe os seguintes em fila, e recusa o resto logo', async () => {
    const a = criarAntepara({ maxConcorrentes: 2, maxFila: 1 });
    const [t1, t2, t3] = [controlada(), controlada(), controlada()];
    const p1 = a.executar(t1.fn);
    const p2 = a.executar(t2.fn);
    const p3 = a.executar(t3.fn);
    await tique();
    assert.equal(a.ativos, 2);
    assert.equal(a.emFila, 1);
    await assert.rejects(a.executar(async () => 'x'), ErroSobrecarga);
    t1.acabar('um');
    assert.equal(await p1, 'um');
    await tique();
    assert.equal(a.ativos, 2, 'a da fila começou');
    assert.equal(a.emFila, 0);
    t2.acabar('dois');
    t3.acabar('três');
    assert.deepEqual(await Promise.all([p2, p3]), ['dois', 'três']);
    assert.equal(a.ativos, 0);
  });

  it('um erro também liberta a vaga', async () => {
    const a = criarAntepara({ maxConcorrentes: 1, maxFila: 1 });
    const t1 = controlada();
    const p1 = a.executar(t1.fn);
    const p2 = a.executar(async () => 'seguinte');
    t1.falhar(new Error('rebentou'));
    await assert.rejects(p1, /rebentou/);
    assert.equal(await p2, 'seguinte');
  });

  it('a fila é por ordem de chegada', async () => {
    const a = criarAntepara({ maxConcorrentes: 1, maxFila: 5 });
    const ordem = [];
    const t0 = controlada();
    const p0 = a.executar(t0.fn);
    const ps = [1, 2, 3].map((n) => a.executar(async () => ordem.push(n)));
    t0.acabar();
    await Promise.all([p0, ...ps]);
    assert.deepEqual(ordem, [1, 2, 3]);
  });
});
