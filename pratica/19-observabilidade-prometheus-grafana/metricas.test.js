import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import { criarMetricas } from './metricas.js';

// O texto que o Prometheus leria em GET /metrics: é isso que os testes inspecionam, linha a linha.
const texto = (registry) => registry.metrics();
const linha = (txt, inicio) => txt.split('\n').find((l) => l.startsWith(inicio));

describe('P1 · métricas da aplicação', () => {
  it('cada chamada a criarMetricas() tem o seu registry (não o global)', async () => {
    const a = criarMetricas();
    const b = criarMetricas();
    assert.notEqual(a.registry, b.registry);
    a.tarefaCriada('web');
    assert.match(linha(await texto(a.registry), 'tarefas_criadas_total{') ?? '', / 1$/);
    assert.match(linha(await texto(b.registry), 'tarefas_criadas_total{') ?? '(nada)', /(nada)| 0$/);
  });

  it('Counter tarefas_criadas_total, por origem, com a label service="pratica"', async () => {
    const m = criarMetricas();
    m.tarefaCriada('web');
    m.tarefaCriada('web');
    m.tarefaCriada('api');
    const txt = await texto(m.registry);
    assert.match(txt, /# TYPE tarefas_criadas_total counter/);
    assert.ok(txt.includes('tarefas_criadas_total{origem="web",service="pratica"} 2'), txt);
    assert.ok(txt.includes('tarefas_criadas_total{origem="api",service="pratica"} 1'));
  });

  it('Gauge mensagens_pendentes: pode subir e descer', async () => {
    const m = criarMetricas();
    m.definirPendentes(12);
    m.definirPendentes(3);
    const txt = await texto(m.registry);
    assert.match(txt, /# TYPE mensagens_pendentes gauge/);
    assert.ok(txt.includes('mensagens_pendentes{service="pratica"} 3'));
  });

  it('Histogram processamento_duracao_segundos: mede em segundos, com os buckets pedidos', async () => {
    const m = criarMetricas();
    const resultado = await m.medirProcessamento(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return 'feito';
    });
    assert.equal(resultado, 'feito', 'devolve o que a função devolveu');

    const txt = await texto(m.registry);
    assert.match(txt, /# TYPE processamento_duracao_segundos histogram/);
    const bucket = (le) => Number(linha(txt, `processamento_duracao_segundos_bucket{le="${le}"`).split(' ').at(-1));
    assert.equal(bucket('0.05'), 0, '60 ms não cabe no bucket ≤ 50 ms (se coube, estás a medir em milissegundos?)');
    assert.equal(bucket('0.1'), 1);
    assert.equal(bucket('+Inf'), 1);
  });

  it('o Histogram regista a duração mesmo quando a função falha', async () => {
    const m = criarMetricas();
    await assert.rejects(
      m.medirProcessamento(async () => {
        throw new Error('falhou');
      }),
      /falhou/,
    );
    assert.ok((await texto(m.registry)).includes('processamento_duracao_segundos_count{service="pratica"} 1'));
  });

  it('o middleware usa o PADRÃO da rota (não o caminho real) e "unmatched" para 404', async () => {
    const m = criarMetricas();
    const app = express();
    app.use(m.middleware);
    app.get('/tarefas/:id', (req, res) => res.json({ id: req.params.id }));
    const server = app.listen(0);
    await once(server, 'listening');
    const base = `http://localhost:${server.address().port}`;
    try {
      for (const caminho of ['/tarefas/1', '/tarefas/2', '/tarefas/3', '/nada']) await (await fetch(base + caminho)).text();
    } finally {
      server.close();
    }
    const txt = await texto(m.registry);
    assert.ok(txt.includes('http_pedidos_total{method="GET",route="/tarefas/:id",status="200",service="pratica"} 3'), txt);
    assert.ok(txt.includes('http_pedidos_total{method="GET",route="unmatched",status="404",service="pratica"} 1'));
    assert.ok(!txt.includes('route="/tarefas/1"'), 'um id na label cria uma série por id: cardinalidade infinita');
  });
});
