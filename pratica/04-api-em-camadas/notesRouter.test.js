import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import { ConflictError, NotFoundError } from './errors.js';
import { createMemoryNoteRepository } from './memoryNoteRepository.js';
import { createNotesRouter } from './notesRouter.js';
import { createNoteService } from './noteService.js';

// Monta uma app mínima à volta do teu router, como faria o app.js do projeto:
// JSON → "autenticação" falsa (utilizador 7) → o teu router → um último middleware de erro (500).
function montarApp(service) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { userId: 7 };
    next();
  });
  app.use(createNotesRouter(service));
  app.use((err, req, res, next) => res.status(500).json({ error: 'Erro interno' }));
  return app;
}

// Faz UM pedido à app: arranca numa porta livre, pede, fecha.
async function pedir(app, method, path, body) {
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(`http://localhost:${server.address().port}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } finally {
    server.close();
  }
}

// Um serviço FALSO: regista as chamadas e devolve o que lhe mandarmos. Assim testamos a camada
// HTTP sozinha. Se um teste falhar aqui, o problema está no router, não no serviço.
function fakeService(resposta = {}) {
  const chamadas = [];
  const metodo = (nome) => async (...args) => {
    chamadas.push([nome, ...args]);
    if (resposta[nome] instanceof Error) throw resposta[nome];
    return resposta[nome];
  };
  return { chamadas, list: metodo('list'), create: metodo('create'), update: metodo('update'), remove: metodo('remove') };
}

describe('P3 · notesRouter (com um serviço falso)', () => {
  it('GET /notes valida a query e passa-a, já convertida, ao serviço', async () => {
    const service = fakeService({ list: [{ id: 1 }] });
    const res = await pedir(montarApp(service), 'GET', '/notes?tag=Docker&pinned=true&limit=5');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [{ id: 1 }]);
    assert.deepEqual(service.chamadas, [['list', 7, { tag: 'docker', pinned: true, limit: 5 }]]);
  });

  it('GET /notes com query inválida dá 400 e nem chama o serviço', async () => {
    const service = fakeService();
    const res = await pedir(montarApp(service), 'GET', '/notes?limit=abc');
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, 'string');
    assert.deepEqual(service.chamadas, []);
  });

  it('POST /notes dá 201 e passa os dados validados (com valores por omissão)', async () => {
    const service = fakeService({ create: { id: 9, title: 'Ideia' } });
    const res = await pedir(montarApp(service), 'POST', '/notes', { title: ' Ideia ' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { id: 9, title: 'Ideia' });
    assert.deepEqual(service.chamadas, [['create', 7, { title: 'Ideia', body: '', tags: [], pinned: false }]]);
  });

  it('POST /notes inválido dá 400 com a mensagem do primeiro problema', async () => {
    const res = await pedir(montarApp(fakeService()), 'POST', '/notes', { title: '' });
    assert.deepEqual(res, { status: 400, body: { error: 'O título é obrigatório' } });
  });

  it('PATCH /notes/:id converte o id para número e valida o corpo', async () => {
    const service = fakeService({ update: { id: 3, title: 'Novo' } });
    const ok = await pedir(montarApp(service), 'PATCH', '/notes/3', { title: 'Novo' });
    assert.equal(ok.status, 200);
    assert.deepEqual(service.chamadas, [['update', 7, 3, { title: 'Novo' }]]);

    assert.equal((await pedir(montarApp(service), 'PATCH', '/notes/abc', { title: 'x' })).status, 400);
    assert.equal((await pedir(montarApp(service), 'PATCH', '/notes/-1', { title: 'x' })).status, 400);
    assert.deepEqual(await pedir(montarApp(service), 'PATCH', '/notes/3', {}), {
      status: 400,
      body: { error: 'Indica pelo menos um campo para alterar' },
    });
  });

  it('DELETE /notes/:id dá 204 sem corpo', async () => {
    const service = fakeService({ remove: undefined });
    const res = await pedir(montarApp(service), 'DELETE', '/notes/3');
    assert.deepEqual(res, { status: 204, body: null });
    assert.deepEqual(service.chamadas, [['remove', 7, 3]]);
  });

  it('traduz NotFoundError → 404 e ConflictError → 409', async () => {
    const naoExiste = fakeService({ update: new NotFoundError('Nota') });
    assert.deepEqual(await pedir(montarApp(naoExiste), 'PATCH', '/notes/3', { title: 'x' }), {
      status: 404,
      body: { error: 'Nota não encontrada' },
    });
    const conflito = fakeService({ create: new ConflictError('Máximo de 3 notas afixadas') });
    assert.deepEqual(await pedir(montarApp(conflito), 'POST', '/notes', { title: 'x', pinned: true }), {
      status: 409,
      body: { error: 'Máximo de 3 notas afixadas' },
    });
  });

  it('um erro inesperado não é tratado pelo router: segue para o middleware de erro da app (500)', async () => {
    const service = fakeService({ list: new Error('ligação à BD caiu') });
    assert.deepEqual(await pedir(montarApp(service), 'GET', '/notes'), { status: 500, body: { error: 'Erro interno' } });
  });
});

describe('P3 · as três camadas juntas (o teu router + o teu serviço + repositório em memória)', () => {
  it('criar, listar, alterar e apagar', async () => {
    const app = montarApp(createNoteService({ repository: createMemoryNoteRepository(), clock: () => new Date().toISOString() }));

    const criada = await pedir(app, 'POST', '/notes', { title: 'Estudar camadas', tags: ['API'] });
    assert.equal(criada.status, 201);
    assert.equal(criada.body.userId, 7);

    const lista = await pedir(app, 'GET', '/notes?tag=api');
    assert.deepEqual(lista.body.map((n) => n.title), ['Estudar camadas']);

    const alterada = await pedir(app, 'PATCH', `/notes/${criada.body.id}`, { pinned: true });
    assert.equal(alterada.body.pinned, true);

    assert.equal((await pedir(app, 'DELETE', `/notes/${criada.body.id}`)).status, 204);
    assert.equal((await pedir(app, 'DELETE', `/notes/${criada.body.id}`)).status, 404);
  });
});
