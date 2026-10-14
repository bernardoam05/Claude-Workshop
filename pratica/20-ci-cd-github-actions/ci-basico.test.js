import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { corre, lerWorkflow, usa } from './ajuda.js';

describe('P1 · ci-basico.yml', () => {
  it('tem um nome e corre em push para o main e em qualquer pull request', () => {
    const { wf } = lerWorkflow('ci-basico.yml');
    assert.equal(typeof wf.name, 'string');
    assert.deepEqual(wf.on?.push?.branches, ['main']);
    assert.ok('pull_request' in (wf.on ?? {}), 'falta o pull_request em on:');
  });

  it('só pede permissão para LER o código (menor privilégio)', () => {
    const { wf } = lerWorkflow('ci-basico.yml');
    assert.deepEqual(wf.permissions, { contents: 'read' });
  });

  it('um job "testes" em ubuntu-latest, com timeout de 10 minutos', () => {
    const { testes } = lerWorkflow('ci-basico.yml').wf.jobs ?? {};
    assert.ok(testes, 'falta o job "testes"');
    assert.equal(testes['runs-on'], 'ubuntu-latest');
    assert.equal(testes['timeout-minutes'], 10);
  });

  it('checkout, Node 22 com cache do npm, npm ci e npm test, por esta ordem', () => {
    const { testes } = lerWorkflow('ci-basico.yml').wf.jobs;
    const checkout = usa(testes, 'actions/checkout@v4');
    const node = usa(testes, 'actions/setup-node@v4');
    assert.ok(checkout, 'falta o actions/checkout@v4');
    assert.ok(node, 'falta o actions/setup-node@v4');
    assert.equal(String(node.with?.['node-version']), '22');
    assert.equal(node.with?.cache, 'npm');

    const ci = corre(testes, 'npm ci');
    const test = corre(testes, 'npm test');
    assert.ok(ci && test, 'faltam os passos "npm ci" e "npm test"');
    const ordem = [checkout, node, ci, test].map((s) => testes.steps.indexOf(s));
    assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'a ordem dos passos importa');
    assert.ok(!corre(testes, 'npm install'), 'no CI usa-se npm ci, nunca npm install (porquê? secção 5)');
  });
});
