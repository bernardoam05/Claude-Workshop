// Corre o Terraform a sério, sobre as pastas dos exercícios.
//
// Se tiveres o `terraform` instalado, usa esse. Se não, descarrega o binário oficial (versão fixa,
// com o checksum SHA-256 verificado) para pratica/.ferramentas/, uma única vez.
// O provider "docker" fala com o mesmo Docker que o teu comando `docker` usa (Docker Desktop ou não).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSAO = '1.14.0';
const aqui = dirname(fileURLToPath(import.meta.url));
const ferramentas = join(aqui, '..', '.ferramentas');

function binario() {
  if (spawnSync('terraform', ['version'], { stdio: 'ignore' }).status === 0) return 'terraform';
  const destino = join(ferramentas, `terraform-${VERSAO}`);
  if (existsSync(destino)) return destino;

  const so = { linux: 'linux', darwin: 'darwin' }[process.platform];
  const arq = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  if (!so || !arq) throw new Error('Instala o Terraform à mão: https://developer.hashicorp.com/terraform/install');
  const base = `https://releases.hashicorp.com/terraform/${VERSAO}`;
  const zip = `terraform_${VERSAO}_${so}_${arq}.zip`;
  // Tudo num nome temporário próprio deste processo (os ficheiros de teste correm em paralelo e
  // podiam descarregar ao mesmo tempo); no fim, um rename atómico põe o binário no sítio.
  const temp = join(ferramentas, `.descarga-${process.pid}`);
  mkdirSync(temp, { recursive: true });
  try {
    const ficheiroZip = join(temp, zip);
    console.log(`(A descarregar o Terraform ${VERSAO} para pratica/.ferramentas/: só acontece uma vez)`);
    const baixar = (url, saida) => spawnSync('curl', ['-sfL', '-o', saida, url], { stdio: 'inherit' }).status === 0;
    if (!baixar(`${base}/${zip}`, ficheiroZip)) throw new Error(`Não consegui descarregar ${base}/${zip}`);
    const somas = spawnSync('curl', ['-sfL', `${base}/terraform_${VERSAO}_SHA256SUMS`], { encoding: 'utf8' }).stdout;
    const esperado = somas.split('\n').find((l) => l.endsWith(zip))?.split(/\s+/)[0];
    const obtido = createHash('sha256').update(readFileSync(ficheiroZip)).digest('hex');
    if (!esperado || esperado !== obtido) throw new Error('O checksum do Terraform descarregado não confere. Não o vou usar.');
    // O zip só tem um ficheiro, "terraform". O Python vem com quase todos os Linux e macOS.
    const extrair = spawnSync('python3', ['-c', 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extract("terraform", sys.argv[2])', ficheiroZip, temp]);
    if (extrair.status !== 0) throw new Error('Não consegui extrair o zip do Terraform (precisas do python3).');
    chmodSync(join(temp, 'terraform'), 0o755);
    renameSync(join(temp, 'terraform'), destino);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  return destino;
}

// O endereço do Docker que o teu `docker` usa (ex.: o socket do Docker Desktop).
function dockerHost() {
  if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
  const r = spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unix:///var/run/docker.sock';
}

export const temDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

// O provider docker não percebe DOCKER_CONTEXT; damos-lhe o endereço já resolvido em DOCKER_HOST.
function ambiente() {
  const env = { ...process.env, DOCKER_HOST: dockerHost(), TF_IN_AUTOMATION: '1', TF_INPUT: '0' };
  delete env.DOCKER_CONTEXT;
  return env;
}

// terraform(pasta, [...args]) → { status, out } (stdout + stderr juntos, sem cores)
export function terraform(pasta, args) {
  const r = spawnSync(binario(), args, {
    cwd: join(aqui, pasta),
    encoding: 'utf8',
    timeout: 300_000,
    env: ambiente(),
  });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Como terraform(), mas falha o teste se o comando falhar, mostrando a saída do Terraform.
export function terraformOk(pasta, args) {
  const r = terraform(pasta, args);
  if (r.status !== 0) throw new Error(`terraform ${args.join(' ')} falhou:\n${r.out}`);
  return r.out;
}

export const outputs = (pasta) =>
  Object.fromEntries(
    Object.entries(JSON.parse(terraformOk(pasta, ['output', '-json']))).map(([k, v]) => [k, v.value]),
  );

// Um "plan" sem alterações devolve 0; com alterações devolve 2 (-detailed-exitcode).
export const semAlteracoes = (pasta, extra = []) => terraform(pasta, ['plan', '-detailed-exitcode', '-no-color', ...extra]).status === 0;

// Só os exercícios já começados: um main.tf com pelo menos uma linha que não é comentário.
export const comecado = (ficheiro) =>
  existsSync(join(aqui, ficheiro)) &&
  readFileSync(join(aqui, ficheiro), 'utf8')
    .split('\n')
    .some((l) => l.trim() && !l.trim().startsWith('#'));

export const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
