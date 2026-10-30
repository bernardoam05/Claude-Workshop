// Corre os teus scripts com o bash, como se fosse no terminal, e devolve o que eles fizeram.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));

// script('contar-niveis.sh', ['a.log'], { input, env }) → { codigo, stdout, stderr }
export function script(nome, args = [], { input, env = {}, timeout = 30_000 } = {}) {
  const r = spawnSync('bash', [join(aqui, nome), ...args], {
    input,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, LC_ALL: 'C', ...env },
  });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}

export const pastaTemporaria = () => mkdtempSync(join(tmpdir(), 'pratica31-'));

// Um script "começado" tem pelo menos uma linha que não é comentário nem o #!.
export function comecado(nome) {
  return readFileSync(join(aqui, nome), 'utf8')
    .split('\n')
    .some((l) => l.trim() && !l.trim().startsWith('#'));
}
