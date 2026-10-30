import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { SpanStatusCode } from '@opentelemetry/api';
import { limpar, spans } from './otel.js';
import { comSpan, processarEncomenda } from './tracing.js';

const porNome = (nome) => spans().find((s) => s.nome === nome);

describe('P2 · comSpan', () => {
  beforeEach(limpar);

  it('cria um span com atributos e devolve o resultado da função', async () => {
    const r = await comSpan('calcular', { 'itens.total': 3 }, async () => 42);
    assert.equal(r, 42);
    const s = porNome('calcular');
    assert.ok(s, 'o span não foi terminado (span.end())');
    assert.deepEqual(s.atributos, { 'itens.total': 3 });
  });

  it('os spans criados lá dentro são seus filhos (o contexto segue os await)', async () => {
    await comSpan('pai', {}, async () => {
      await new Promise((r) => setTimeout(r, 5));
      await comSpan('filho', {}, async () => {});
    });
    const pai = porNome('pai');
    const filho = porNome('filho');
    assert.equal(filho.traceId, pai.traceId);
    assert.equal(filho.pai, pai.spanId);
  });

  it('um erro fica registado no span, que termina na mesma, e o erro propaga-se', async () => {
    await assert.rejects(comSpan('arriscado', {}, async () => { throw new Error('rebentou'); }), /rebentou/);
    const s = porNome('arriscado');
    assert.ok(s, 'o span tem de terminar mesmo quando há erro');
    assert.equal(s.estado.code, SpanStatusCode.ERROR);
    assert.equal(s.estado.message, 'rebentou');
    assert.deepEqual(s.eventos, ['exception']);
  });
});

describe('P2 · processarEncomenda', () => {
  beforeEach(limpar);
  const ok = async () => {};

  it('um span por passo, todos filhos do span da encomenda, pela ordem', async () => {
    assert.equal(await processarEncomenda({ id: 'E1', total: 30 }, { validar: ok, cobrar: ok, notificar: ok }), 'concluida');
    const raiz = porNome('processar-encomenda');
    assert.deepEqual(raiz.atributos, { 'encomenda.id': 'E1', 'encomenda.total': 30 });
    const filhos = spans().filter((s) => s.pai === raiz.spanId).map((s) => s.nome);
    assert.deepEqual(filhos, ['validar', 'cobrar', 'notificar']);
  });

  it('uma falha a cobrar faz falhar a encomenda', async () => {
    await assert.rejects(processarEncomenda({ id: 'E2', total: 1 }, { validar: ok, cobrar: async () => { throw new Error('cartão recusado'); }, notificar: ok }), /cartão recusado/);
    assert.equal(porNome('cobrar').estado.code, SpanStatusCode.ERROR);
    assert.equal(porNome('processar-encomenda').estado.code, SpanStatusCode.ERROR);
    assert.equal(porNome('notificar'), undefined, 'depois de uma falha a cobrar, não se notifica');
  });

  it('uma falha a notificar não faz falhar a encomenda, mas fica visível', async () => {
    const r = await processarEncomenda({ id: 'E3', total: 1 }, { validar: ok, cobrar: ok, notificar: async () => { throw new Error('SMTP em baixo'); } });
    assert.equal(r, 'concluida');
    assert.equal(porNome('notificar').estado.code, SpanStatusCode.ERROR);
    const raiz = porNome('processar-encomenda');
    assert.notEqual(raiz.estado.code, SpanStatusCode.ERROR);
    assert.deepEqual(raiz.eventos, ['notificacao-falhou']);
  });
});
