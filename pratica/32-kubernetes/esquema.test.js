// Validação contra o ESQUEMA oficial do Kubernetes, com o kubeconform (num contentor Docker).
// Os outros testes verificam as regras do exercício; este apanha o resto: um campo com o nome
// errado (containerport em vez de containerPort), um tipo errado, um campo que não existe.
// É o que o "kubectl apply" te diria, sem precisares de um cluster.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const pasta = fileURLToPath(new URL('./manifests', import.meta.url));
const IMAGEM = 'ghcr.io/yannh/kubeconform:v0.7.0-alpine';
const temDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

const ficheiros = ['app.yaml', 'config.yaml', 'exposicao-e-escala.yaml', 'cronjob.yaml'];
// Só valida os ficheiros que já começaste (com pelo menos uma linha que não é comentário).
const comecado = (f) =>
  readFileSync(`${pasta}/${f}`, 'utf8')
    .split('\n')
    .some((l) => l.trim() && !l.trim().startsWith('#') && l.trim() !== '---');

describe('esquema oficial do Kubernetes (kubeconform)', () => {
  for (const f of ficheiros) {
    it(`${f} é válido para o Kubernetes 1.33`, { skip: !temDocker && 'sem Docker: este teste precisa dele' }, (t) => {
      if (!comecado(f)) return t.skip('ainda não começaste este ficheiro');
      // O YAML entra pelo stdin ("-"): assim não é preciso partilhar pastas com o Docker.
      const r = spawnSync(
        'docker',
        ['run', '--rm', '-i', IMAGEM, '-strict', '-summary', '-kubernetes-version', '1.33.0', '-'],
        { encoding: 'utf8', input: readFileSync(`${pasta}/${f}`, 'utf8') },
      );
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    });
  }
});
