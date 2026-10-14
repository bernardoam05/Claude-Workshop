// Testes partilhados pelo P2 (node:http) e pelo P3 (Express): o contrato HTTP é o mesmo,
// só muda a ferramenta. Não é um ficheiro de teste por si: é chamado pelos dois *.test.js.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, describe, it } from 'node:test';

export function describeTasksContract(nome, criarHandler) {
  describe(nome, () => {
    let server;
    let base;

    // O servidor arranca no primeiro teste e é partilhado pelos seguintes (o estado acumula-se:
    // o POST do 3.º teste é visto pelo GET a seguir). Arrancar dentro do teste, e não num before(),
    // faz com que um erro teu (ex.: "Por fazer") apareça como a falha do teste, bem visível.
    async function iniciar() {
      if (!server) {
        const handler = criarHandler();
        // Um http.Server já é um servidor; uma app Express é uma função (req, res): embrulhamo-la.
        server = handler instanceof http.Server ? handler : http.createServer(handler);
        server.listen(0); // porta 0 = o sistema operativo escolhe uma livre
        await once(server, 'listening');
        base = `http://localhost:${server.address().port}`;
      }
    }

    after(() => server?.close());

    const postTask = (body) =>
      fetch(`${base}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });

    it('GET /health responde 200 com JSON', async () => {
      await iniciar();
      const res = await fetch(`${base}/health`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /application\/json/);
      assert.deepEqual(await res.json(), { status: 'ok' });
    });

    it('GET /tasks começa com uma lista vazia', async () => {
      await iniciar();
      const res = await fetch(`${base}/tasks`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), []);
    });

    it('POST /tasks cria uma tarefa com 201 e id sequencial', async () => {
      await iniciar();
      const r1 = await postTask({ title: '  Estudar HTTP  ' });
      assert.equal(r1.status, 201);
      assert.match(r1.headers.get('content-type'), /application\/json/);
      assert.deepEqual(await r1.json(), { id: 1, title: 'Estudar HTTP', done: false });

      const r2 = await postTask({ title: 'Segunda' });
      assert.equal((await r2.json()).id, 2);

      const lista = await (await fetch(`${base}/tasks`)).json();
      assert.deepEqual(lista.map((t) => t.title), ['Estudar HTTP', 'Segunda']);
    });

    it('POST /tasks com JSON inválido dá 400 com {error}', async () => {
      await iniciar();
      const res = await postTask('{isto não é json');
      assert.equal(res.status, 400);
      assert.equal(typeof (await res.json()).error, 'string');
    });

    it('POST /tasks sem title válido dá 400 com {error}', async () => {
      await iniciar();
      for (const body of [{}, { title: '   ' }, { title: 42 }]) {
        const res = await postTask(body);
        assert.equal(res.status, 400, `corpo ${JSON.stringify(body)} devia dar 400`);
        assert.equal(typeof (await res.json()).error, 'string');
      }
    });

    it('método não suportado em /tasks dá 405 com o cabeçalho Allow', async () => {
      await iniciar();
      const res = await fetch(`${base}/tasks`, { method: 'DELETE' });
      assert.equal(res.status, 405);
      assert.match(res.headers.get('allow') ?? '', /GET/);
      assert.match(res.headers.get('allow') ?? '', /POST/);
    });

    it('caminho desconhecido dá 404 com {error}', async () => {
      await iniciar();
      const res = await fetch(`${base}/nada`);
      assert.equal(res.status, 404);
      assert.equal(typeof (await res.json()).error, 'string');
    });
  });
}
