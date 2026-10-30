import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarRecetor } from './recetor.js';

describe('P4 · recetor de webhooks', () => {
  it('avança pelo caminho normal', () => {
    const r = criarRecetor();
    assert.equal(r.estado('pg1'), 'pendente');
    assert.equal(r.receber({ id: 'e1', pagamento: 'pg1', estado: 'autorizado' }), 'processado');
    assert.equal(r.receber({ id: 'e2', pagamento: 'pg1', estado: 'capturado' }), 'processado');
    assert.equal(r.estado('pg1'), 'capturado');
  });
  it('ignora duplicados', () => {
    const r = criarRecetor();
    r.receber({ id: 'e1', pagamento: 'pg1', estado: 'autorizado' });
    assert.equal(r.receber({ id: 'e1', pagamento: 'pg1', estado: 'autorizado' }), 'duplicado');
  });
  it('aguenta a ordem trocada', () => {
    const r = criarRecetor();
    assert.equal(r.receber({ id: 'e2', pagamento: 'pg1', estado: 'capturado' }), 'processado');
    assert.equal(r.receber({ id: 'e1', pagamento: 'pg1', estado: 'autorizado' }), 'ignorado');
    assert.equal(r.estado('pg1'), 'capturado');
    assert.equal(r.receber({ id: 'e1', pagamento: 'pg1', estado: 'autorizado' }), 'duplicado');
  });
  it('falhado só antes da captura, e é final', () => {
    const r = criarRecetor();
    r.receber({ id: 'a', pagamento: 'pg1', estado: 'capturado' });
    assert.equal(r.receber({ id: 'b', pagamento: 'pg1', estado: 'falhado' }), 'ignorado');
    assert.equal(r.receber({ id: 'c', pagamento: 'pg2', estado: 'autorizado' }), 'processado');
    assert.equal(r.receber({ id: 'd', pagamento: 'pg2', estado: 'falhado' }), 'processado');
    assert.equal(r.receber({ id: 'e', pagamento: 'pg2', estado: 'capturado' }), 'ignorado');
    assert.equal(r.estado('pg2'), 'falhado');
  });
  it('pagamentos independentes', () => {
    const r = criarRecetor();
    r.receber({ id: 'a', pagamento: 'pg1', estado: 'reembolsado' });
    assert.equal(r.estado('pg2'), 'pendente');
  });
  it('estado desconhecido', () => {
    assert.throws(() => criarRecetor().receber({ id: 'x', pagamento: 'p', estado: 'pago' }), /pago/);
  });
});
