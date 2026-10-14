import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { corre, lerWorkflow, usa } from './ajuda.js';

const jobs = () => lerWorkflow('ci-completo.yml').wf.jobs ?? {};

describe('P2 · ci-completo.yml', () => {
  it('tem os jobs lint, testes, integracao e build', () => {
    assert.deepEqual(Object.keys(jobs()).sort(), ['build', 'integracao', 'lint', 'testes']);
  });

  it('testes corre numa MATRIZ de Node 20 e 22, sem parar as outras se uma falhar', () => {
    const { testes } = jobs();
    assert.deepEqual(testes.strategy?.matrix?.['node-version']?.map(String), ['20', '22']);
    assert.equal(testes.strategy?.['fail-fast'], false);
    const node = usa(testes, 'actions/setup-node@v4');
    assert.match(String(node?.with?.['node-version']), /\$\{\{\s*matrix\.node-version\s*\}\}/, 'o setup-node tem de usar a versão da matriz');
  });

  it('integracao só corre se lint e testes passarem, e tem um Postgres 16 ao lado', () => {
    const { integracao } = jobs();
    assert.deepEqual([integracao.needs].flat().sort(), ['lint', 'testes']);
    const pg = integracao.services?.postgres;
    assert.ok(pg, 'falta o serviço "postgres" em services:');
    assert.match(pg.image, /^postgres:16/);
    assert.ok(pg.env?.POSTGRES_PASSWORD, 'o Postgres precisa de POSTGRES_PASSWORD');
    assert.ok((pg.ports ?? []).map(String).includes('5432:5432'), 'expõe a porta 5432 ao job');
    assert.match(pg.options ?? '', /--health-cmd/, 'sem healthcheck, os testes começavam antes de o Postgres aceitar ligações');
    assert.match(String(integracao.env?.DATABASE_URL ?? ''), /^postgres:\/\/.+@localhost:5432\//, 'DATABASE_URL a apontar para localhost:5432');
    assert.ok(corre(integracao, 'npm run test:integration'));
  });

  it('build só corre depois da integracao, e guarda o dist/ como artefacto', () => {
    const { build } = jobs();
    assert.deepEqual([build.needs].flat(), ['integracao']);
    const upload = usa(build, 'actions/upload-artifact@v4');
    assert.ok(upload, 'falta o actions/upload-artifact@v4');
    assert.equal(upload.with?.path, 'dist/');
  });

  it('se os testes de integração falharem, guarda os logs (if: failure())', () => {
    const { integracao } = jobs();
    const logs = integracao.steps.find((s) => /failure\(\)/.test(String(s.if ?? '')));
    assert.ok(logs, 'falta um passo com if: failure()');
    assert.match(String(logs.uses ?? ''), /^actions\/upload-artifact@v4/);
  });
});
