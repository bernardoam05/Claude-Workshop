import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arrancarApi, correrK6, temDocker, thresholds } from './ajuda.js';

describe('P1 · carga-basica.js', { skip: !temDocker && 'precisa do Docker (o k6 corre num contentor)' }, () => {
  it('corre 5 vus durante 3 s, com os checks e os thresholds pedidos, e passa', async () => {
    const api = await arrancarApi();
    try {
      const { codigo, resumo, stderr } = await correrK6('carga-basica.js', { BASE_URL: api.baseUrl });
      const m = resumo.metrics;
      assert.deepEqual(thresholds(resumo, 'http_req_failed'), { 'rate<0.01': true });
      assert.deepEqual(thresholds(resumo, 'http_req_duration'), { 'p(95)<300': true });
      assert.deepEqual(thresholds(resumo, 'checks'), { 'rate>0.99': true });
      const checks = resumo.root_group.checks.map((c) => [c.name, c.fails]);
      assert.deepEqual(checks, [['status 200', 0], ['é uma lista', 0]]);
      assert.ok(m.iterations.values.count >= 60, `só ${m.iterations.values.count} iterações: são 5 vus durante 3 s, com pausas de 0,1 s`);
      assert.ok(m.iterations.values.count <= 200, `${m.iterations.values.count} iterações: falta o sleep(0.1)?`);
      assert.equal(m.vus_max.values.max, 5);
      assert.equal(codigo, 0, stderr);
    } finally {
      api.fechar();
    }
  });
});
