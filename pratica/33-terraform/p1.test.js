import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import { comecado, outputs, semAlteracoes, terraform, terraformOk } from './ajuda.js';

const P = 'p1-ficheiros';
const gerado = new URL(`./${P}/gerado/`, import.meta.url);
const listar = () => (existsSync(gerado) ? readdirSync(gerado).sort() : []);
const ler = (f) => readFileSync(new URL(f, gerado), 'utf8');

let iniciado = false;
function preparar() {
  assert.ok(comecado(`${P}/main.tf`), `ainda não começaste o ${P}/main.tf`);
  if (!iniciado) {
    terraformOk(P, ['init', '-no-color']);
    iniciado = true;
  }
}

describe('P1 · variáveis, for_each e outputs (provider local)', () => {
  after(() => iniciado && terraform(P, ['destroy', '-auto-approve', '-no-color']));

  it('o código está formatado como o terraform fmt o deixaria', () => {
    preparar();
    const r = terraform(P, ['fmt', '-check', '-diff', '-no-color']);
    assert.equal(r.status, 0, `corre "terraform fmt" dentro de ${P}/ e vê o que mudou:\n${r.out}`);
  });

  it('terraform validate não encontra erros', () => {
    preparar();
    terraformOk(P, ['validate', '-no-color']);
  });

  it('a validação da variável "ambiente" recusa valores que não sejam dev ou prod', () => {
    preparar();
    const r = terraform(P, ['plan', '-no-color', '-var', 'ambiente=teste']);
    assert.notEqual(r.status, 0, 'o plan com ambiente=teste devia falhar');
    assert.match(r.out, /ambiente/i, 'a error_message deve explicar o problema e falar do "ambiente"');
  });

  it('o apply cria um ficheiro por serviço, com o conteúdo pedido', () => {
    preparar();
    terraformOk(P, ['apply', '-auto-approve', '-no-color']);
    assert.deepEqual(listar(), ['dev-api.env', 'dev-worker.env']);
    assert.equal(ler('dev-api.env'), 'PORT=3000\nAMBIENTE=dev\n');
    assert.equal(ler('dev-worker.env'), 'PORT=3001\nAMBIENTE=dev\n');
  });

  it('o output "ficheiros" é a lista ordenada dos nomes', () => {
    preparar();
    assert.deepEqual(outputs(P).ficheiros, ['dev-api.env', 'dev-worker.env']);
  });

  it('um segundo plan não tem nada para fazer (o estado já corresponde ao código)', () => {
    preparar();
    assert.ok(semAlteracoes(P), 'o plan devia dizer "No changes"');
  });

  it('mudar as variáveis muda a infraestrutura: o worker desaparece e o api muda de porta', () => {
    preparar();
    const vars = ['-var', 'servicos={ api = 4000 }', '-var', 'ambiente=prod'];
    terraformOk(P, ['apply', '-auto-approve', '-no-color', ...vars]);
    assert.deepEqual(listar(), ['prod-api.env']);
    assert.equal(ler('prod-api.env'), 'PORT=4000\nAMBIENTE=prod\n');
    assert.ok(semAlteracoes(P, vars));
  });

  it('o destroy apaga tudo o que o Terraform criou', () => {
    preparar();
    terraformOk(P, ['destroy', '-auto-approve', '-no-color']);
    assert.deepEqual(listar(), []);
  });
});
