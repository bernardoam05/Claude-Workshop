import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

// Serviço falso: testar HTTP não precisa de nenhuma infraestrutura real.
const fakeService = {
  listTasks: async () => ({ tasks: [{ id: 1, title: 'x', done: false }], source: 'database' }),
  createTask: async (userId, title) => ({ id: 2, title, done: false, userId }),
  updateTask: async (userId, id) => (id === 1 ? { id, title: 'x', done: true } : null),
  deleteTask: async (userId, id) => id === 1,
  getStats: async () => ({ total: 1, done: 1, processedCompleted: 0 }),
};

// Auth falso: o token 'bom' corresponde ao utilizador 1. Qualquer outro é inválido.
const fakeAuth = {
  verifyToken: (token) => {
    if (token === 'bom') return { userId: 1 };
    throw new Error('token inválido');
  },
  register: async (email) => ({ user: { id: 1, email }, token: 'bom' }),
  login: async () => {
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 });
  },
};

// Arranca o servidor numa porta livre (0), corre o teste e fecha-o.
async function withServer(fn) {
  const app = createApp({ service: fakeService, authService: fakeAuth, healthCheck: async () => {} });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const json = (body, token = 'bom') => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

test('GET /api/tasks sem token devolve 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks`);
    assert.equal(res.status, 401);
  });
});

test('GET /api/tasks com token inválido devolve 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks`, { headers: { Authorization: 'Bearer lixo' } });
    assert.equal(res.status, 401);
  });
});

test('POST /api/tasks com título vazio devolve 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks`, json({ title: '   ' }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /obrigatório/);
  });
});

test('POST /api/tasks válido com token devolve 201', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks`, json({ title: 'Nova' }));
    assert.equal(res.status, 201);
    assert.equal((await res.json()).title, 'Nova');
  });
});

test('PATCH com id inexistente devolve 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks/999`, { ...json({ done: true }), method: 'PATCH' });
    assert.equal(res.status, 404);
  });
});

test('PATCH com id não numérico devolve 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks/abc`, { ...json({ done: true }), method: 'PATCH' });
    assert.equal(res.status, 400);
  });
});

test('GET /api/tasks expõe o cabeçalho X-Cache', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/tasks`, { headers: { Authorization: 'Bearer bom' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-cache'), 'MISS');
  });
});

test('POST /api/auth/register com email inválido devolve 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/auth/register`, json({ email: 'nao-e-email', password: 'password-segura' }, null));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Email inválido/);
  });
});

test('POST /api/auth/register válido devolve 201 com token', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/auth/register`, json({ email: 'ana@exemplo.pt', password: 'password-segura' }, null));
    assert.equal(res.status, 201);
    assert.equal((await res.json()).token, 'bom');
  });
});

test('POST /api/auth/login com credenciais erradas devolve 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/auth/login`, json({ email: 'ana@exemplo.pt', password: 'password-errada' }, null));
    assert.equal(res.status, 401);
  });
});

test('GET /metrics expõe métricas Prometheus com a rota como padrão (não o id real)', async () => {
  const { createMetrics } = await import('../src/observability/metrics.js');
  const metrics = createMetrics();
  const app = createApp({ service: fakeService, authService: fakeAuth, healthCheck: async () => {}, metrics });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  try {
    await fetch(`${base}/api/tasks/1`, { method: 'DELETE', headers: { Authorization: 'Bearer bom' } });
    const body = await (await fetch(`${base}/metrics`)).text();

    assert.match(body, /http_request_duration_seconds_count\{.*route="\/api\/tasks\/:id".*\} 1/);
    assert.doesNotMatch(body, /route="\/api\/tasks\/1"/);
  } finally {
    server.close();
  }
});

test('rota desconhecida devolve 404 em JSON (com token válido)', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/nada`, { headers: { Authorization: 'Bearer bom' } });
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error);
  });
});
