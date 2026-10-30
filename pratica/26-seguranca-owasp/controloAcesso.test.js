import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { criarApp } from './controloAcesso.js';

async function arrancar() {
  const notas = [
    { id: 1, dono: 'ana', titulo: 'Da Ana', texto: 'a' },
    { id: 2, dono: 'bruno', titulo: 'Do Bruno', texto: 'segredo' },
  ];
  const server = criarApp(notas).listen(0);
  await once(server, 'listening');
  const base = `http://localhost:${server.address().port}`;
  const pedir = (utilizador, metodo, caminho, corpo) =>
    fetch(base + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(utilizador && { 'X-Utilizador': utilizador }) },
      body: corpo && JSON.stringify(corpo),
    });
  return { notas, pedir, fechar: () => server.close() };
}

describe('P3 · uso normal', () => {
  it('cada um vê e edita as suas notas', async () => {
    const { pedir, fechar } = await arrancar();
    try {
      assert.equal((await pedir('ana', 'GET', '/notas/1')).status, 200);
      const r = await pedir('ana', 'PATCH', '/notas/1', { titulo: 'Novo', texto: 'b' });
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { id: 1, dono: 'ana', titulo: 'Novo', texto: 'b' });
    } finally {
      fechar();
    }
  });

  it('sem X-Utilizador, 401', async () => {
    const { pedir, fechar } = await arrancar();
    try {
      assert.equal((await pedir(null, 'GET', '/notas')).status, 401);
    } finally {
      fechar();
    }
  });
});

describe('P3 · ataques', () => {
  it('IDOR: a Ana muda o id no URL e tenta ler a nota do Bruno → 404', async () => {
    const { pedir, fechar } = await arrancar();
    try {
      const r = await pedir('ana', 'GET', '/notas/2');
      assert.equal(r.status, 404);
      assert.ok(!(await r.text()).includes('segredo'));
    } finally {
      fechar();
    }
  });

  it('IDOR na escrita: a Ana não altera a nota do Bruno', async () => {
    const { notas, pedir, fechar } = await arrancar();
    try {
      assert.equal((await pedir('ana', 'PATCH', '/notas/2', { titulo: 'apagado' })).status, 404);
      assert.equal(notas[1].titulo, 'Do Bruno');
    } finally {
      fechar();
    }
  });

  it('mass assignment: o PATCH ignora "dono" e "id"', async () => {
    const { notas, pedir, fechar } = await arrancar();
    try {
      const r = await pedir('ana', 'PATCH', '/notas/1', { titulo: 'ok', dono: 'bruno', id: 99 });
      assert.equal(r.status, 200);
      assert.deepEqual(notas[0], { id: 1, dono: 'ana', titulo: 'ok', texto: 'a' });
    } finally {
      fechar();
    }
  });

  it('a nota inexistente e a nota de outro dão a MESMA resposta (não se descobre o que existe)', async () => {
    const { pedir, fechar } = await arrancar();
    try {
      const outra = await pedir('ana', 'GET', '/notas/2');
      const inexistente = await pedir('ana', 'GET', '/notas/999');
      assert.equal(outra.status, inexistente.status);
      assert.deepEqual(await outra.json(), await inexistente.json());
    } finally {
      fechar();
    }
  });
});
