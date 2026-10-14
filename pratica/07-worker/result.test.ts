import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { err, map, ok, parseEvent, partition, type Result } from './result.js';

// ---------------------------------------------------------------------------------------------
// Testes de TIPOS (ver a explicação em events.test.ts).
// ---------------------------------------------------------------------------------------------
function tipos(r: Result<number>): void {
  // @ts-expect-error: antes de verificar r.ok, o compilador não sabe se há value
  r.value;
  if (r.ok) {
    const n: number = r.value; // depois de verificar, sabe
    void n;
  } else {
    const e: string = r.error; // o tipo do erro, por omissão, é string
    void e;
  }

  const texto: Result<string> = map(r, (n) => n.toFixed(2)); // map muda o tipo do valor...
  // @ts-expect-error: ...por isso o resultado já não é um Result<number>
  const numero: Result<number> = map(r, (n) => n.toFixed(2));
  void [texto, numero];

  const comErroProprio: Result<number, { codigo: number }> = err({ codigo: 404 }); // E pode ser outro tipo
  void comErroProprio;
}
void tipos;

describe('P2 · ok, err, map, partition', () => {
  it('ok e err constroem os dois lados', () => {
    assert.deepEqual(ok(5), { ok: true, value: 5 });
    assert.deepEqual(err('falhou'), { ok: false, error: 'falhou' });
  });

  it('map transforma o valor de um sucesso e deixa passar uma falha sem chamar a função', () => {
    assert.deepEqual(map(ok(2), (n: number) => n * 10), { ok: true, value: 20 });
    let chamada = false;
    const falha: Result<number> = err('não deu');
    assert.deepEqual(
      map(falha, (n) => {
        chamada = true;
        return n * 10;
      }),
      { ok: false, error: 'não deu' },
    );
    assert.equal(chamada, false);
  });

  it('partition separa valores de erros, mantendo a ordem', () => {
    const resultados: Result<number>[] = [ok(1), err('a'), ok(2), err('b')];
    assert.deepEqual(partition(resultados), { values: [1, 2], errors: ['a', 'b'] });
    assert.deepEqual(partition([]), { values: [], errors: [] });
  });
});

describe('P2 · parseEvent', () => {
  const evento = {
    eventId: 'e1',
    occurredAt: '2026-01-01T00:00:00Z',
    type: 'task.completed',
    task: { id: 1, title: 'x', done: true, userId: 1 },
  };

  it('um evento válido dá ok com o evento', () => {
    assert.deepEqual(parseEvent(Buffer.from(JSON.stringify(evento))), { ok: true, value: evento });
  });

  it('bytes que não são JSON dão err("JSON inválido"), sem lançar', () => {
    assert.deepEqual(parseEvent(Buffer.from('{isto')), { ok: false, error: 'JSON inválido' });
  });

  it('JSON com a forma errada dá err("formato de evento inválido")', () => {
    assert.deepEqual(parseEvent(Buffer.from('{"eventId":"e1"}')), { ok: false, error: 'formato de evento inválido' });
    assert.deepEqual(parseEvent(Buffer.from('null')), { ok: false, error: 'formato de evento inválido' });
  });
});
