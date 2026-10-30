import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comecado, script } from './ajuda.js';

const linha = (metodo, caminho, ms) => JSON.stringify({ ts: '2026-10-29T10:00:00Z', metodo, caminho, status: 200, ms });

const PEDIDOS = [
  linha('GET', '/api/tasks', 900),
  linha('GET', '/api/tasks', 1001),
  linha('POST', '/api/tasks', 300),
  'isto não é JSON',
  linha('GET', '/api/health', 5),
  linha('GET', '/api/stats', 400),
  linha('GET', '/api/stats', 501),
  '',
  linha('DELETE', '/api/tasks/1', 50),
].join('\n');

describe('P2 · mais-lentos.sh', () => {
  it('as 3 rotas mais lentas por média, ignorando linhas que não são JSON', () => {
    assert.ok(comecado('mais-lentos.sh'), 'ainda não começaste o mais-lentos.sh');
    const r = script('mais-lentos.sh', [], { input: PEDIDOS });
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.stdout, 'GET /api/tasks 951\nGET /api/stats 451\nPOST /api/tasks 300\n');
  });

  it('aceita N', () => {
    const r = script('mais-lentos.sh', ['1'], { input: PEDIDOS });
    assert.equal(r.stdout, 'GET /api/tasks 951\n');
    const todas = script('mais-lentos.sh', ['10'], { input: PEDIDOS });
    assert.equal(todas.stdout.trim().split('\n').length, 5);
  });

  it('sem pedidos válidos, não escreve nada e não falha', () => {
    assert.ok(comecado('mais-lentos.sh'), 'ainda não começaste o mais-lentos.sh');
    const r = script('mais-lentos.sh', [], { input: 'lixo\n' });
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.stdout, '');
  });

  it('N inválido: código 2', () => {
    for (const n of ['0', '-1', 'abc', '2.5']) {
      const r = script('mais-lentos.sh', [n], { input: PEDIDOS });
      assert.equal(r.codigo, 2, `N=${n}`);
      assert.notEqual(r.stderr, '');
    }
  });
});
