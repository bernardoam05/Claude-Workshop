import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arrancarApi, correrK6, temDocker, thresholds } from './ajuda.js';

describe('P2 · rampa.js', { skip: !temDocker && 'precisa do Docker (o k6 corre num contentor)' }, () => {
  it('sobe até 10 vus, cria e lê tarefas, com uma métrica própria', async () => {
    const api = await arrancarApi();
    try {
      const { codigo, resumo, stderr } = await correrK6('rampa.js', { BASE_URL: api.baseUrl });
      const m = resumo.metrics;
      assert.equal(m.vus_max.values.max, 10, 'o máximo de vus devia ser 10');
      assert.ok(resumo.state.testRunDurationMs >= 5500 && resumo.state.testRunDurationMs < 9000, `durou ${resumo.state.testRunDurationMs} ms (2 + 3 + 1 s)`);
      assert.ok(m.tempo_criacao, 'falta a Trend "tempo_criacao"');
      assert.equal(m.tempo_criacao.contains, 'time', 'a Trend devia ser criada com isTime = true');
      assert.deepEqual(thresholds(resumo, 'tempo_criacao'), { 'p(95)<300': true });
      assert.deepEqual(thresholds(resumo, 'http_req_failed'), { 'rate<0.01': true });
      assert.deepEqual(Object.fromEntries(resumo.root_group.checks.map((c) => [c.name, c.fails])), { criada: 0, lida: 0 });
      assert.equal(m.http_reqs.values.count, 2 * m.iterations.values.count, 'dois pedidos por iteração');
      assert.equal(m.tempo_criacao.values.count ?? m.iterations.values.count, m.iterations.values.count);
      assert.equal(codigo, 0, stderr);
    } finally {
      api.fechar();
    }
  });

  it('as leituras são agrupadas por uma tag name (e não uma URL por id)', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./rampa.js', import.meta.url), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); // sem os comentários
    assert.match(codigo, /name:\s*['"]GET \/api\/tarefas\/:id['"]/);
  });
});
