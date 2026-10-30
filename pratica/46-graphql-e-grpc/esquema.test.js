import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSchema } from 'graphql';
import { lerEsquema } from './ajuda.js';

const esquema = () => buildSchema(lerEsquema());
const tipoDe = (tipo, campo) => esquema().getType(tipo)?.getFields()[campo]?.type.toString();
const argumento = (tipo, campo, arg) => esquema().getType(tipo).getFields()[campo].args.find((a) => a.name === arg);

describe('P1 · o esquema', () => {
  it('é SDL válido', () => {
    esquema();
  });

  it('Tarefa e Utilizador, com a nulabilidade pedida', () => {
    assert.equal(tipoDe('Tarefa', 'id'), 'ID!');
    assert.equal(tipoDe('Tarefa', 'titulo'), 'String!');
    assert.equal(tipoDe('Tarefa', 'feita'), 'Boolean!');
    assert.equal(tipoDe('Tarefa', 'dono'), 'Utilizador!');
    assert.equal(tipoDe('Utilizador', 'id'), 'ID!');
    assert.equal(tipoDe('Utilizador', 'nome'), 'String!');
    assert.equal(tipoDe('Utilizador', 'tarefas'), '[Tarefa!]!');
    assert.equal(argumento('Utilizador', 'tarefas', 'feita')?.type.toString(), 'Boolean');
  });

  it('as consultas', () => {
    assert.equal(tipoDe('Query', 'eu'), 'Utilizador');
    assert.equal(tipoDe('Query', 'tarefa'), 'Tarefa');
    assert.equal(argumento('Query', 'tarefa', 'id').type.toString(), 'ID!');
    assert.equal(tipoDe('Query', 'tarefas'), '[Tarefa!]!');
    assert.equal(argumento('Query', 'tarefas', 'feita').type.toString(), 'Boolean');
    const primeiras = argumento('Query', 'tarefas', 'primeiras');
    assert.equal(primeiras.type.toString(), 'Int');
    // O valor por omissão, como está escrito no SDL (no graphql 17 já não vem em defaultValue).
    assert.equal(primeiras.astNode?.defaultValue?.value, '10', 'falta o "= 10"');
  });

  it('as mutações', () => {
    assert.equal(tipoDe('Mutation', 'criarTarefa'), 'Tarefa!');
    assert.equal(argumento('Mutation', 'criarTarefa', 'titulo').type.toString(), 'String!');
    assert.equal(tipoDe('Mutation', 'concluirTarefa'), 'Tarefa');
    assert.equal(argumento('Mutation', 'concluirTarefa', 'id').type.toString(), 'ID!');
  });
});
