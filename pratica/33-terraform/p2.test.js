import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { comecado, docker, outputs, semAlteracoes, temDocker, terraform, terraformOk } from './ajuda.js';

const P = 'p2-docker';
const inspecionar = (nome) => {
  const r = docker('inspect', nome);
  return r.status === 0 ? JSON.parse(r.stdout)[0] : null;
};

let iniciado = false;
function preparar() {
  assert.ok(comecado(`${P}/main.tf`), `ainda não começaste o ${P}/main.tf`);
  if (!iniciado) {
    terraformOk(P, ['init', '-no-color']);
    terraformOk(P, ['apply', '-auto-approve', '-no-color']);
    iniciado = true;
  }
}

describe('P2 · rede, volume e contentores (provider docker)', { skip: !temDocker && 'precisa do Docker a correr' }, () => {
  after(() => iniciado && terraform(P, ['destroy', '-auto-approve', '-no-color']));

  it('formatado e válido', () => {
    preparar();
    assert.equal(terraform(P, ['fmt', '-check', '-no-color']).status, 0, `corre "terraform fmt" dentro de ${P}/`);
    terraformOk(P, ['validate', '-no-color']);
  });

  it('cria a rede e põe lá os dois contentores', () => {
    preparar();
    const rede = inspecionar('tf-pratica-rede');
    assert.ok(rede, 'não existe a rede tf-pratica-rede');
    const ligados = Object.values(rede.Containers ?? {}).map((c) => c.Name).sort();
    assert.deepEqual(ligados, ['tf-pratica-redis', 'tf-pratica-web']);
  });

  it('o redis guarda os dados no volume com nome, e não publica portas', () => {
    preparar();
    const redis = inspecionar('tf-pratica-redis');
    assert.ok(redis, 'não existe o contentor tf-pratica-redis');
    // Com image = docker_image.redis.image_id, o contentor guarda o ID (sha256:...), não o nome.
    const idRedis = docker('image', 'inspect', '--format', '{{.Id}}', 'redis:7-alpine').stdout.trim();
    assert.equal(redis.Image, idRedis, 'o contentor tf-pratica-redis não usa a imagem redis:7-alpine');
    const mount = redis.Mounts.find((m) => m.Destination === '/data');
    assert.equal(mount?.Type, 'volume');
    assert.equal(mount?.Name, 'tf-pratica-redis-dados');
    const publicadas = Object.values(redis.HostConfig.PortBindings ?? {}).flat().filter(Boolean);
    assert.deepEqual(publicadas, [], 'o redis não deve estar acessível de fora da rede');
  });

  it('o web responde em 127.0.0.1:8091 com o index.html enviado pelo Terraform', async () => {
    preparar();
    const web = inspecionar('tf-pratica-web');
    assert.deepEqual(web?.HostConfig?.PortBindings?.['80/tcp'], [{ HostIp: '127.0.0.1', HostPort: '8091' }]);
    let texto = '';
    for (let i = 0; i < 20 && !texto.includes('Terraform'); i++) {
      texto = await fetch('http://127.0.0.1:8091/').then((r) => r.text(), () => '');
      if (!texto.includes('Terraform')) await new Promise((r) => setTimeout(r, 250));
    }
    assert.match(texto, /Feito com Terraform/);
  });

  it('output "url" e nenhuma alteração pendente', () => {
    preparar();
    assert.equal(outputs(P).url, 'http://127.0.0.1:8091');
    assert.ok(semAlteracoes(P), 'um segundo plan devia dizer "No changes"');
  });

  it('o destroy apaga contentores, rede e volume, mas mantém as imagens (keep_locally)', () => {
    preparar();
    terraformOk(P, ['destroy', '-auto-approve', '-no-color']);
    for (const nome of ['tf-pratica-web', 'tf-pratica-redis', 'tf-pratica-rede', 'tf-pratica-redis-dados']) {
      assert.equal(inspecionar(nome), null, `${nome} ainda existe depois do destroy`);
    }
    assert.equal(docker('image', 'inspect', 'redis:7-alpine').status, 0, 'a imagem redis:7-alpine foi apagada: falta keep_locally = true');
    iniciado = false;
  });
});
