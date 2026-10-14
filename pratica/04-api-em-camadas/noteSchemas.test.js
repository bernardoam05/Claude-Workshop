import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as schemas from './noteSchemas.js';

// Primeira mensagem de erro do zod, ou null se a validação passou.
const primeiroErro = (schema, input) => {
  const r = schema.safeParse(input);
  return r.success ? null : r.error.issues[0].message;
};

describe('P1 · createNoteSchema', () => {
  const { createNoteSchema } = schemas;

  it('aceita o mínimo e preenche os valores por omissão', () => {
    assert.ok(createNoteSchema, 'noteSchemas.js tem de exportar createNoteSchema');
    assert.deepEqual(createNoteSchema.parse({ title: 'Ideia' }), { title: 'Ideia', body: '', tags: [], pinned: false });
  });

  it('limpa o título e normaliza as tags (trim, minúsculas, sem repetidas)', () => {
    const nota = createNoteSchema.parse({ title: '  Ideia  ', tags: [' Docker', 'docker', 'SQL '], pinned: true });
    assert.equal(nota.title, 'Ideia');
    assert.deepEqual(nota.tags, ['docker', 'sql']);
    assert.equal(nota.pinned, true);
  });

  it('título obrigatório (1 a 120 caracteres), com mensagens em português', () => {
    assert.equal(primeiroErro(createNoteSchema, {}), 'O título é obrigatório');
    assert.equal(primeiroErro(createNoteSchema, { title: '   ' }), 'O título é obrigatório');
    assert.equal(primeiroErro(createNoteSchema, { title: 'x'.repeat(121) }), 'Máximo de 120 caracteres');
  });

  it('body até 2000 caracteres; no máximo 5 tags, cada uma com 1 a 20 caracteres', () => {
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', body: 'x'.repeat(2001) }), null);
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', tags: ['1', '2', '3', '4', '5', '6'] }), null);
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', tags: [''] }), null);
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', tags: ['x'.repeat(21)] }), null);
  });

  it('rejeita tipos errados e campos desconhecidos (ex.: alguém a tentar mandar o userId)', () => {
    assert.notEqual(primeiroErro(createNoteSchema, { title: 42 }), null);
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', pinned: 'sim' }), null);
    assert.notEqual(primeiroErro(createNoteSchema, { title: 'a', userId: 7 }), null);
  });
});

describe('P1 · updateNoteSchema', () => {
  const { updateNoteSchema } = schemas;

  it('todos os campos são opcionais, e os ausentes NÃO ganham valores por omissão', () => {
    assert.ok(updateNoteSchema, 'noteSchemas.js tem de exportar updateNoteSchema');
    // Se o PATCH só muda o título, não pode "desafixar" a nota por o pinned voltar a false.
    assert.deepEqual(updateNoteSchema.parse({ title: ' Novo ' }), { title: 'Novo' });
    assert.deepEqual(updateNoteSchema.parse({ pinned: true }), { pinned: true });
  });

  it('as mesmas regras por campo do createNoteSchema', () => {
    assert.equal(primeiroErro(updateNoteSchema, { title: '' }), 'O título é obrigatório');
    assert.notEqual(primeiroErro(updateNoteSchema, { tags: ['1', '2', '3', '4', '5', '6'] }), null);
  });

  it('um corpo vazio é um erro: um PATCH tem de mudar alguma coisa', () => {
    assert.equal(primeiroErro(updateNoteSchema, {}), 'Indica pelo menos um campo para alterar');
  });
});

describe('P1 · listQuerySchema', () => {
  const { listQuerySchema } = schemas;

  it('sem nada, devolve só o limit por omissão (20)', () => {
    assert.ok(listQuerySchema, 'noteSchemas.js tem de exportar listQuerySchema');
    assert.deepEqual(listQuerySchema.parse({}), { limit: 20 });
  });

  it('converte as strings da query string para os tipos certos', () => {
    // Tudo o que vem da URL é string. "false" tem de virar false, não true!
    assert.deepEqual(listQuerySchema.parse({ tag: 'Docker', pinned: 'false', limit: '5' }), {
      tag: 'docker',
      pinned: false,
      limit: 5,
    });
    assert.equal(listQuerySchema.parse({ pinned: 'true' }).pinned, true);
  });

  it('rejeita valores inválidos', () => {
    for (const query of [{ pinned: 'sim' }, { limit: '0' }, { limit: '51' }, { limit: '2.5' }, { limit: 'abc' }]) {
      assert.notEqual(primeiroErro(listQuerySchema, query), null, JSON.stringify(query));
    }
  });
});
