import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { comecado, pastaTemporaria, script } from './ajuda.js';

function origem() {
  const dir = join(pastaTemporaria(), 'dados');
  mkdirSync(join(dir, 'sub'), { recursive: true });
  writeFileSync(join(dir, 'notas.txt'), 'olá\n');
  writeFileSync(join(dir, 'sub', 'x.txt'), 'x\n');
  return dir;
}

const permissoes = (f) => (statSync(f).mode & 0o777).toString(8);

describe('P3 · backup.sh', () => {
  it('cria o backup com o nome do instante, caminhos relativos, e diz onde ficou', () => {
    assert.ok(comecado('backup.sh'), 'ainda não começaste o backup.sh');
    const destino = join(pastaTemporaria(), 'backups');
    const r = script('backup.sh', [origem(), destino], { env: { AGORA: '20261029-101500' } });
    assert.equal(r.codigo, 0, r.stderr);
    const ficheiro = join(destino, 'backup-20261029-101500.tar.gz');
    assert.equal(r.stdout.trim(), ficheiro);
    const conteudo = spawnSync('tar', ['-tzf', ficheiro], { encoding: 'utf8' }).stdout.split('\n').map((l) => l.replace(/^\.\//, '')).filter((l) => l && !l.endsWith('/'));
    assert.deepEqual(conteudo.sort(), ['notas.txt', 'sub/x.txt']);
  });

  it('a pasta dos backups fica com 700 e o ficheiro com 600', () => {
    const destino = join(pastaTemporaria(), 'backups');
    const r = script('backup.sh', [origem(), destino], { env: { AGORA: '20261029-101500' } });
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(permissoes(destino), '700');
    assert.equal(permissoes(join(destino, 'backup-20261029-101500.tar.gz')), '600');
  });

  it('mantém só os KEEP mais recentes', () => {
    const dados = origem();
    const destino = join(pastaTemporaria(), 'backups');
    for (const t of ['20261001-000000', '20261002-000000', '20261003-000000', '20261004-000000', '20261005-000000']) {
      const r = script('backup.sh', [dados, destino], { env: { AGORA: t, KEEP: '2' } });
      assert.equal(r.codigo, 0, r.stderr);
    }
    assert.deepEqual(readdirSync(destino).sort(), ['backup-20261004-000000.tar.gz', 'backup-20261005-000000.tar.gz']);
  });

  it('se o tar falhar a meio, não fica nenhum ficheiro (nem temporário, nem meio backup)', () => {
    const destino = join(pastaTemporaria(), 'backups');
    const dados = origem();
    // Um "tar" falso, que escreve qualquer coisa e falha: simula um disco cheio a meio.
    const bin = pastaTemporaria();
    writeFileSync(join(bin, 'tar'), '#!/bin/sh\nfor a in "$@"; do case "$a" in *.tar.gz*|*tmp*) echo lixo > "$a";; esac; done\nexit 1\n', { mode: 0o755 });
    const r = script('backup.sh', [dados, destino], { env: { AGORA: '20261029-101500', PATH: `${bin}:${process.env.PATH}` } });
    assert.notEqual(r.codigo, 0, 'o script devia falhar quando o tar falha (set -e)');
    assert.deepEqual(existsSync(destino) ? readdirSync(destino) : [], [], 'ficou lixo na pasta dos backups');
  });

  it('erros de utilização', () => {
    assert.equal(script('backup.sh', []).codigo, 2);
    assert.equal(script('backup.sh', ['/nao/existe', pastaTemporaria()]).codigo, 1);
  });
});
