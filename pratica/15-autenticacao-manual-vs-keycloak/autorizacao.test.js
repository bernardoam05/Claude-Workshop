import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import { exigirAutenticacao, exigirPapel, podeEditar } from './autorizacao.js';

// Tokens falsos: o verificador aceita estes dois e lança para tudo o resto.
const UTILIZADORES = {
  'token-da-ana': { userId: 1, papeis: ['user'] },
  'token-da-carla': { userId: 3, papeis: ['user', 'admin'] },
};
const verificarToken = async (token) => {
  if (!UTILIZADORES[token]) throw new Error('token inválido');
  return UTILIZADORES[token];
};

function montarApp() {
  const app = express();
  const auth = exigirAutenticacao(verificarToken);
  app.get('/perfil', auth, (req, res) => res.json(req.utilizador));
  app.get('/admin', auth, exigirPapel('admin'), (req, res) => res.json({ ok: true }));
  app.get('/gestao', auth, exigirPapel('admin', 'gestor'), (req, res) => res.json({ ok: true }));
  return app;
}

async function pedir(caminho, autorizacao) {
  const server = montarApp().listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(`http://localhost:${server.address().port}${caminho}`, {
      headers: autorizacao ? { Authorization: autorizacao } : {},
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

describe('P4 · exigirAutenticacao', () => {
  it('com um Bearer válido, passa e põe o utilizador em req.utilizador', async () => {
    assert.deepEqual(await pedir('/perfil', 'Bearer token-da-ana'), { status: 200, body: { userId: 1, papeis: ['user'] } });
  });

  it('sem cabeçalho, com outro esquema, ou com token inválido → 401 com {error}', async () => {
    for (const cabecalho of [undefined, 'token-da-ana', 'Basic token-da-ana', 'Bearer ', 'Bearer token-falso']) {
      const r = await pedir('/perfil', cabecalho);
      assert.equal(r.status, 401, `Authorization: ${cabecalho}`);
      assert.equal(typeof r.body.error, 'string');
    }
  });
});

describe('P4 · exigirPapel', () => {
  it('autenticado mas sem o papel → 403 (sabemos quem és, mas não podes)', async () => {
    const r = await pedir('/admin', 'Bearer token-da-ana');
    assert.equal(r.status, 403);
    assert.equal(typeof r.body.error, 'string');
  });

  it('com o papel → passa; com um de vários papéis aceites → passa', async () => {
    assert.equal((await pedir('/admin', 'Bearer token-da-carla')).status, 200);
    assert.equal((await pedir('/gestao', 'Bearer token-da-carla')).status, 200);
  });

  it('sem autenticação, a resposta continua a ser 401 (e não 403)', async () => {
    assert.equal((await pedir('/admin')).status, 401);
  });
});

describe('P4 · podeEditar', () => {
  const tarefaDaAna = { id: 10, userId: 1 };
  it('o dono pode; outro utilizador não; um admin pode sempre', () => {
    assert.equal(podeEditar(UTILIZADORES['token-da-ana'], tarefaDaAna), true);
    assert.equal(podeEditar({ userId: 2, papeis: ['user'] }, tarefaDaAna), false);
    assert.equal(podeEditar(UTILIZADORES['token-da-carla'], tarefaDaAna), true);
  });
});
