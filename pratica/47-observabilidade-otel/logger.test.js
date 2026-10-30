import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { trace } from '@opentelemetry/api';
import { limpar } from './otel.js';
import { criarLogger } from './logger.js';

const AGORA = () => new Date('2026-10-29T10:00:00.000Z');
function capturar(opcoes = {}) {
  const linhas = [];
  const log = criarLogger({ escrever: (l) => linhas.push(l), agora: AGORA, ...opcoes });
  return { log, linhas, json: () => linhas.map((l) => JSON.parse(l)) };
}

describe('P1 · logger estruturado', () => {
  beforeEach(limpar);

  it('escreve uma linha JSON por evento, com os campos pela ordem certa', () => {
    const { log, linhas } = capturar({ base: { servico: 'api' } });
    log.info('pedido recebido', { metodo: 'GET', caminho: '/api/tasks' });
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0], '{"ts":"2026-10-29T10:00:00.000Z","nivel":"info","msg":"pedido recebido","servico":"api","metodo":"GET","caminho":"/api/tasks"}');
  });

  it('filtra pelo nível mínimo', () => {
    const { log, json } = capturar({ nivel: 'warn' });
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    assert.deepEqual(json().map((l) => l.nivel), ['warn', 'error']);
  });

  it('esconde segredos a qualquer profundidade', () => {
    const { log, json } = capturar();
    log.info('login', { utilizador: 'ana', password: 'x', pedido: { cabecalhos: { Authorization: 'Bearer abc', 'content-type': 'json' }, token: 't' }, Cookie: 'c' });
    const l = json()[0];
    assert.equal(l.password, '[REDACTED]');
    assert.equal(l.pedido.cabecalhos.Authorization, '[REDACTED]');
    assert.equal(l.pedido.cabecalhos['content-type'], 'json');
    assert.equal(l.pedido.token, '[REDACTED]');
    assert.equal(l.Cookie, '[REDACTED]');
    assert.equal(l.utilizador, 'ana');
  });

  it('um Error vira um objeto legível (o JSON.stringify de um Error dá {})', () => {
    const { log, json } = capturar();
    log.error('falhou', { erro: new TypeError('x é undefined') });
    const { erro } = json()[0];
    assert.equal(erro.nome, 'TypeError');
    assert.equal(erro.mensagem, 'x é undefined');
    assert.match(erro.stack, /TypeError: x é undefined/);
  });

  it('filho acrescenta campos a todas as linhas (sem mudar o pai)', () => {
    const { log, json } = capturar({ base: { servico: 'api' } });
    const doPedido = log.filho({ pedido_id: 'r-1' });
    doPedido.info('a');
    log.info('b');
    const [a, b] = json();
    assert.equal(a.pedido_id, 'r-1');
    assert.equal(a.servico, 'api');
    assert.equal(b.pedido_id, undefined);
  });

  it('dentro de um span, cada linha leva o trace_id e o span_id (é o que liga logs a traces)', () => {
    const { log, json } = capturar();
    log.info('fora');
    trace.getTracer('t').startActiveSpan('trabalho', (span) => {
      log.info('dentro');
      span.end();
      const [fora, dentro] = json();
      assert.equal(fora.trace_id, undefined);
      assert.equal(dentro.trace_id, span.spanContext().traceId);
      assert.equal(dentro.span_id, span.spanContext().spanId);
    });
  });
});
