import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lerWorkflow, usa } from './ajuda.js';

const ler = () => lerWorkflow('deploy.yml');

describe('P3 · deploy.yml', () => {
  it('corre quando se cria uma tag v* (uma versão), ou à mão (workflow_dispatch)', () => {
    const { wf } = ler();
    assert.deepEqual(wf.on?.push?.tags, ['v*']);
    assert.ok('workflow_dispatch' in (wf.on ?? {}));
  });

  it('nunca dois deploys ao mesmo tempo (concurrency)', () => {
    const { wf } = ler();
    assert.ok(wf.concurrency?.group, 'falta concurrency.group');
    assert.equal(wf.concurrency['cancel-in-progress'], false, 'um deploy a meio não se cancela: espera');
  });

  it('pode ler o código e escrever pacotes (para publicar a imagem), e mais nada', () => {
    assert.deepEqual(ler().wf.permissions, { contents: 'read', packages: 'write' });
  });

  it('um job "imagem" no ambiente "producao"', () => {
    const { imagem } = ler().wf.jobs ?? {};
    assert.ok(imagem, 'falta o job "imagem"');
    assert.equal(imagem.environment, 'producao');
  });

  it('autentica-se no ghcr.io com o GITHUB_TOKEN (nunca uma password escrita no ficheiro)', () => {
    const { imagem } = ler().wf.jobs;
    const login = usa(imagem, 'docker/login-action@v3');
    assert.ok(login, 'falta o docker/login-action@v3');
    assert.equal(login.with?.registry, 'ghcr.io');
    assert.match(String(login.with?.username), /\$\{\{\s*github\.actor\s*\}\}/);
    assert.match(String(login.with?.password), /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
  });

  it('constrói e publica a imagem com a tag da versão', () => {
    const { imagem } = ler().wf.jobs;
    const build = usa(imagem, 'docker/build-push-action@v6');
    assert.ok(build, 'falta o docker/build-push-action@v6');
    assert.equal(build.with?.push, true);
    assert.match(String(build.with?.tags), /ghcr\.io\/\$\{\{\s*github\.repository\s*\}\}:\$\{\{\s*github\.ref_name\s*\}\}/);
  });

  it('nenhum segredo escrito no ficheiro', () => {
    const { texto } = ler();
    assert.doesNotMatch(texto, /(password|token)\s*:\s*['"]?(?!\$\{\{)[A-Za-z0-9_-]{8,}/i);
  });
});
