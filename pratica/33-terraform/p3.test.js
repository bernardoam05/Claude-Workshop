import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { comecado, docker, outputs, semAlteracoes, temDocker, terraform, terraformOk } from './ajuda.js';

const P = 'p3-modulo';

let iniciado = false;
function preparar() {
  assert.ok(comecado(`${P}/main.tf`), `ainda não começaste o ${P}/main.tf`);
  assert.ok(comecado(`${P}/modulos/site/main.tf`), `ainda não começaste o ${P}/modulos/site/main.tf`);
  if (!iniciado) {
    terraformOk(P, ['init', '-no-color']);
    iniciado = true;
  }
}

const texto = async (url) => {
  for (let i = 0; i < 20; i++) {
    const t = await fetch(url).then((r) => r.text(), () => '');
    if (t) return t;
    await new Promise((r) => setTimeout(r, 250));
  }
  return '';
};

describe('P3 · um módulo reutilizado com for_each', { skip: !temDocker && 'precisa do Docker a correr' }, () => {
  after(() => iniciado && terraform(P, ['destroy', '-auto-approve', '-no-color']));

  it('formatado (raiz e módulo) e válido', () => {
    preparar();
    assert.equal(terraform(P, ['fmt', '-check', '-recursive', '-no-color']).status, 0, `corre "terraform fmt -recursive" dentro de ${P}/`);
    terraformOk(P, ['validate', '-no-color']);
  });

  it('a validação do módulo recusa portas abaixo de 1024', () => {
    preparar();
    const r = terraform(P, ['plan', '-no-color', '-var', 'sites={ x = { porta = 80, mensagem = "y" } }']);
    assert.notEqual(r.status, 0, 'o plan com porta 80 devia falhar');
    assert.match(r.out, /porta/i);
  });

  it('o apply cria um site por entrada do map, cada um com a sua mensagem', async () => {
    preparar();
    terraformOk(P, ['apply', '-auto-approve', '-no-color']);
    assert.equal(docker('inspect', 'tf-pratica-azul').status, 0, 'não existe o contentor tf-pratica-azul');
    assert.equal(docker('inspect', 'tf-pratica-verde').status, 0, 'não existe o contentor tf-pratica-verde');
    assert.match(await texto('http://127.0.0.1:8092/'), /Site azul/);
    assert.match(await texto('http://127.0.0.1:8093/'), /Site verde/);
  });

  it('o output "urls" junta as saídas dos módulos', () => {
    preparar();
    assert.deepEqual(outputs(P).urls, { azul: 'http://127.0.0.1:8092', verde: 'http://127.0.0.1:8093' });
    assert.ok(semAlteracoes(P));
  });

  it('o destroy apaga os dois sites', () => {
    preparar();
    terraformOk(P, ['destroy', '-auto-approve', '-no-color']);
    assert.notEqual(docker('inspect', 'tf-pratica-azul').status, 0);
    assert.notEqual(docker('inspect', 'tf-pratica-verde').status, 0);
    iniciado = false;
  });
});
