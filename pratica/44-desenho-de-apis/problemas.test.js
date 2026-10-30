import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { Conflito, ErroValidacao, NaoEncontrado, enviarProblema, paraProblema } from './problemas.js';

describe('P1 · Problem Details', () => {
  it('validação: 422 com a lista de erros', () => {
    const e = new ErroValidacao([{ campo: 'titulo', mensagem: 'obrigatório' }]);
    assert.deepEqual(paraProblema(e, { instancia: '/api/tasks' }), {
      status: 422,
      corpo: {
        type: 'https://tarefas.pt/problemas/validacao',
        title: 'Dados inválidos',
        status: 422,
        instance: '/api/tasks',
        errors: [{ campo: 'titulo', mensagem: 'obrigatório' }],
      },
    });
  });
  it('404 e 409 com detalhe', () => {
    assert.deepEqual(paraProblema(new NaoEncontrado('A tarefa 42 não existe'), { instancia: '/api/tasks/42' }).corpo, {
      type: 'https://tarefas.pt/problemas/nao-encontrado',
      title: 'Não encontrado',
      status: 404,
      detail: 'A tarefa 42 não existe',
      instance: '/api/tasks/42',
    });
    assert.equal(paraProblema(new Conflito('Já existe'), { instancia: '/x' }).status, 409);
  });
  it('um erro inesperado não revela a mensagem', () => {
    const r = paraProblema(new Error('relation "users" does not exist at /srv/app/db.js:12'), { instancia: '/api/me' });
    assert.deepEqual(r, { status: 500, corpo: { type: 'about:blank', title: 'Erro interno', status: 500, instance: '/api/me' } });
  });
  it('a resposta HTTP tem o tipo certo', async () => {
    const s = createServer((req, res) => {
      try {
        enviarProblema(res, new NaoEncontrado('nada'), req.url);
      } catch (e) {
        res.writeHead(599).end(e.message);
      }
    });
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    try {
      const r = await fetch(`http://127.0.0.1:${s.address().port}/api/x`);
      assert.equal(r.status, 404);
      assert.equal(r.headers.get('content-type'), 'application/problem+json');
      assert.equal((await r.json()).instance, '/api/x');
    } finally {
      s.close();
    }
  });
});
