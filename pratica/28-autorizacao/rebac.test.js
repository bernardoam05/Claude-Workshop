import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarReBAC } from './rebac.js';

const modelo = {
  utilizador: {},
  grupo: { membro: [] },
  pasta: { dono: [], leitor: ['dono', 'pai->leitor'], pai: [] },
  documento: { dono: [], editor: ['dono'], leitor: ['editor', 'pai->leitor'], pai: [] },
};
const tuplos = [
  'documento:d1#dono@utilizador:ana',
  'documento:d1#pai@pasta:p1',
  'documento:d2#editor@utilizador:eva',
  'documento:d3#pai@pasta:p2',
  'pasta:p1#leitor@grupo:eng#membro',
  'pasta:p2#pai@pasta:p1',
  'grupo:eng#membro@utilizador:rui',
  'grupo:eng#membro@grupo:estagiarios#membro',
  'grupo:estagiarios#membro@utilizador:tiago',
];
const r = () => criarReBAC(modelo, tuplos);

describe('P3 · ReBAC', () => {
  it('tuplos diretos', () => {
    assert.equal(r().verificar('documento:d1', 'dono', 'utilizador:ana'), true);
    assert.equal(r().verificar('documento:d1', 'dono', 'utilizador:rui'), false);
  });
  it('relações derivadas no mesmo objeto (dono → editor → leitor)', () => {
    assert.equal(r().verificar('documento:d1', 'leitor', 'utilizador:ana'), true);
    assert.equal(r().verificar('documento:d2', 'leitor', 'utilizador:eva'), true);
    assert.equal(r().verificar('documento:d2', 'dono', 'utilizador:eva'), false);
  });
  it('através de grupos, incluindo grupos dentro de grupos', () => {
    assert.equal(r().verificar('pasta:p1', 'leitor', 'utilizador:rui'), true);
    assert.equal(r().verificar('pasta:p1', 'leitor', 'utilizador:tiago'), true);
  });
  it('através da hierarquia de pastas', () => {
    assert.equal(r().verificar('documento:d1', 'leitor', 'utilizador:rui'), true, 'leitor da pasta pai');
    assert.equal(r().verificar('documento:d3', 'leitor', 'utilizador:tiago'), true, 'dois níveis de pastas, e um grupo dentro de um grupo');
    assert.equal(r().verificar('documento:d1', 'editor', 'utilizador:rui'), false, 'ler a pasta não dá para editar');
  });
  it('listar', () => {
    assert.deepEqual(r().listar('documento', 'leitor', 'utilizador:rui'), ['documento:d1', 'documento:d3']);
    assert.deepEqual(r().listar('documento', 'leitor', 'utilizador:ana'), ['documento:d1']);
    assert.deepEqual(r().listar('documento', 'leitor', 'utilizador:ninguem'), []);
  });
  it('não fica preso em ciclos', () => {
    const c = criarReBAC(modelo, ['grupo:a#membro@grupo:b#membro', 'grupo:b#membro@grupo:a#membro', 'pasta:x#pai@pasta:y', 'pasta:y#pai@pasta:x']);
    assert.equal(c.verificar('grupo:a', 'membro', 'utilizador:ana'), false);
    assert.equal(c.verificar('pasta:x', 'leitor', 'utilizador:ana'), false);
  });
  it('relações que não existem no modelo', () => {
    assert.throws(() => r().verificar('documento:d1', 'apagador', 'utilizador:ana'), /apagador/);
  });
});
