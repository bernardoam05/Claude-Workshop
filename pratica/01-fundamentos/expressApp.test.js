import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { createApp } from './expressApp.js';
import { describeTasksContract } from './tasksContract.js';

describeTasksContract('P3 · app Express (mesmo contrato do P2)', createApp);

describe('P3 · extras do Express', () => {
  it('todas as respostas (até os erros) trazem um X-Request-Id único', async () => {
    const server = createApp().listen(0);
    await once(server, 'listening');
    const base = `http://localhost:${server.address().port}`;
    try {
      const ids = [];
      for (const caminho of ['/health', '/health', '/nada']) {
        const id = (await fetch(base + caminho)).headers.get('x-request-id') ?? '';
        assert.match(id, /^[0-9a-f-]{36}$/, `${caminho} sem X-Request-Id em formato UUID`);
        ids.push(id);
      }
      assert.equal(new Set(ids).size, 3, 'cada pedido tem de ter um id diferente');
    } finally {
      server.close();
    }
  });
});
