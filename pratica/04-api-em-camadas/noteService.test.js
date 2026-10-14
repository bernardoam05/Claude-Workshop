import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictError, DomainError, NotFoundError } from './errors.js';
import { createMemoryNoteRepository } from './memoryNoteRepository.js';
import { createNoteService } from './noteService.js';

describe('P2 · errors.js', () => {
  it('NotFoundError e ConflictError são DomainError, que é um Error', () => {
    const nf = new NotFoundError('Nota');
    assert.ok(nf instanceof NotFoundError && nf instanceof DomainError && nf instanceof Error);
    assert.equal(nf.message, 'Nota não encontrada');
    assert.equal(nf.name, 'NotFoundError');

    const c = new ConflictError('Já existe');
    assert.ok(c instanceof ConflictError && c instanceof DomainError);
    assert.equal(c.message, 'Já existe');
    assert.equal(c.name, 'ConflictError');
  });
});

// Um relógio falso: cada chamada avança um minuto. Assim os testes sabem exatamente que hora sai.
function fakeClock() {
  let minuto = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 10, minuto++)).toISOString();
}

const nota = (title, extra = {}) => ({ title, body: '', tags: [], pinned: false, ...extra });

function novoServico() {
  const repository = createMemoryNoteRepository();
  return { repository, service: createNoteService({ repository, clock: fakeClock() }) };
}

describe('P2 · noteService', () => {
  it('create guarda a nota com userId e datas vindas do clock', async () => {
    const { service } = novoServico();
    const criada = await service.create(1, nota('Ideia', { tags: ['docker'] }));
    assert.deepEqual(criada, {
      id: 1,
      userId: 1,
      title: 'Ideia',
      body: '',
      tags: ['docker'],
      pinned: false,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
  });

  it('list só devolve as notas do próprio utilizador', async () => {
    const { service } = novoServico();
    await service.create(1, nota('Da Ana'));
    await service.create(2, nota('Do Bruno'));
    assert.deepEqual((await service.list(1, {})).map((n) => n.title), ['Da Ana']);
  });

  it('list ordena: afixadas primeiro, depois a mais recentemente alterada', async () => {
    const { service } = novoServico();
    await service.create(1, nota('A'));
    await service.create(1, nota('B', { pinned: true }));
    await service.create(1, nota('C'));
    assert.deepEqual((await service.list(1, {})).map((n) => n.title), ['B', 'C', 'A']);
  });

  it('list filtra por tag e por pinned, e respeita o limit', async () => {
    const { service } = novoServico();
    await service.create(1, nota('A', { tags: ['sql'] }));
    await service.create(1, nota('B', { tags: ['sql', 'docker'], pinned: true }));
    await service.create(1, nota('C', { tags: ['docker'] }));
    assert.deepEqual((await service.list(1, { tag: 'sql' })).map((n) => n.title), ['B', 'A']);
    assert.deepEqual((await service.list(1, { pinned: false })).map((n) => n.title), ['C', 'A']);
    assert.deepEqual((await service.list(1, { limit: 1 })).map((n) => n.title), ['B']);
  });

  it('no máximo 3 notas afixadas por utilizador: a 4.ª dá ConflictError', async () => {
    const { service } = novoServico();
    for (const t of ['1', '2', '3']) await service.create(1, nota(t, { pinned: true }));
    await assert.rejects(service.create(1, nota('4', { pinned: true })), ConflictError);
    await assert.doesNotReject(service.create(2, nota('do Bruno', { pinned: true })), 'o limite é por utilizador');
  });

  it('update altera só os campos pedidos e atualiza o updatedAt', async () => {
    const { service } = novoServico();
    const { id } = await service.create(1, nota('Velho', { tags: ['x'] }));
    const alterada = await service.update(1, id, { title: 'Novo' });
    assert.equal(alterada.title, 'Novo');
    assert.deepEqual(alterada.tags, ['x']);
    assert.equal(alterada.createdAt, '2026-01-01T10:00:00.000Z');
    assert.equal(alterada.updatedAt, '2026-01-01T10:01:00.000Z');
  });

  it('update aplica o limite de afixadas, mas voltar a afixar uma já afixada não conta duas vezes', async () => {
    const { service } = novoServico();
    const notas = [];
    for (const t of ['1', '2', '3']) notas.push(await service.create(1, nota(t, { pinned: true })));
    const solta = await service.create(1, nota('solta'));
    await assert.rejects(service.update(1, solta.id, { pinned: true }), ConflictError);
    await assert.doesNotReject(service.update(1, notas[0].id, { pinned: true }));
  });

  it('update e remove de uma nota inexistente OU de outro utilizador dão NotFoundError', async () => {
    const { service } = novoServico();
    const { id } = await service.create(1, nota('Da Ana'));
    await assert.rejects(service.update(1, 999, { title: 'x' }), NotFoundError);
    await assert.rejects(service.update(2, id, { title: 'x' }), NotFoundError);
    await assert.rejects(service.remove(2, id), NotFoundError);
  });

  it('remove apaga a nota', async () => {
    const { service } = novoServico();
    const { id } = await service.create(1, nota('Temporária'));
    await service.remove(1, id);
    assert.deepEqual(await service.list(1, {}), []);
  });
});
