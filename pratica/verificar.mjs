#!/usr/bin/env node
// Corre os testes de um módulo da prática: `npm run verificar 04` (ou `npm run verificar 04 schemas`
// para correr só os ficheiros de teste cujo nome contém "schemas").
//
// Cada pasta NN-* usa a ferramenta normal da sua linguagem; este script só decide qual:
//   pom.xml       → Maven (Java)        · *.csproj     → dotnet test (C#)
//   verificar.sh  → script de shell     · *.test.jsx   → Vitest (React, precisa de um DOM)
//   playwright.config.js → Playwright (estilos: só um browser a sério calcula o layout)
//   verificar.mjs → um verificador próprio do módulo (ex.: o 11, que testa os TEUS testes)
//   o resto       → node --test (o mesmo executor de testes da API em src/api)
// Se o Maven ou o dotnet não estiverem instalados, corre-os dentro de um contentor Docker.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const [modulo, filtro = ''] = process.argv.slice(2);

const modulos = readdirSync(root).filter((nome) => /^\d{2}-/.test(nome)).sort();

if (!modulo) {
  console.log('Uso: npm run verificar <NN> [filtro]\n\nMódulos com prática:');
  for (const nome of modulos) console.log(`  ${nome}`);
  process.exit(1);
}

const pasta = modulos.find((nome) => nome.startsWith(modulo.padStart(2, '0')));
if (!pasta) {
  console.error(`Não há prática para o módulo "${modulo}". Corre "npm run verificar" para ver a lista.`);
  process.exit(1);
}
const dir = join(root, pasta);

// Lista recursiva de ficheiros, ignorando o que é gerado (dependências, builds).
function ficheiros(base) {
  const ignorar = new Set(['node_modules', 'target', 'bin', 'obj', 'dist']);
  return readdirSync(base).flatMap((nome) => {
    const caminho = join(base, nome);
    if (statSync(caminho).isDirectory()) return ignorar.has(nome) ? [] : ficheiros(caminho);
    return [caminho];
  });
}

const temComando = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;

function correr(cmd, args, opcoes = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opcoes });
  if (r.error) {
    console.error(`Não consegui correr "${cmd}": ${r.error.message}`);
    return 1;
  }
  return r.status ?? 1;
}

// No Linux, sem isto os ficheiros criados dentro do contentor (target/, bin/) ficariam do root.
const utilizadorDocker = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : [];

function maven() {
  const args = ['-q', 'test', ...(filtro ? [`-Dtest=*${filtro}*`, '-Dsurefire.failIfNoSpecifiedTests=false'] : [])];
  if (temComando('mvn')) return correr('mvn', args, { cwd: dir });
  console.log('(Maven não encontrado: a correr dentro do contentor maven:3.9-eclipse-temurin-21)');
  const m2 = join(homedir(), '.m2');
  mkdirSync(m2, { recursive: true });
  return correr('docker', [
    'run', '--rm', ...utilizadorDocker,
    '-v', `${dir}:/app`, '-v', `${m2}:/tmp/.m2`, '-w', '/app', '-e', 'HOME=/tmp',
    'maven:3.9-eclipse-temurin-21', 'mvn', '-Dmaven.repo.local=/tmp/.m2/repository', ...args,
  ]);
}

function dotnet() {
  const args = ['test', ...(filtro ? ['--filter', `FullyQualifiedName~${filtro}`] : [])];
  if (temComando('dotnet')) return correr('dotnet', args, { cwd: dir });
  console.log('(dotnet não encontrado: a correr dentro do contentor mcr.microsoft.com/dotnet/sdk:10.0)');
  const nuget = join(homedir(), '.nuget');
  mkdirSync(nuget, { recursive: true });
  return correr('docker', [
    'run', '--rm', ...utilizadorDocker,
    '-v', `${dir}:/app`, '-v', `${nuget}:/tmp/.nuget`, '-w', '/app',
    '-e', 'HOME=/tmp', '-e', 'DOTNET_CLI_HOME=/tmp', '-e', 'NUGET_PACKAGES=/tmp/.nuget/packages',
    '-e', 'DOTNET_NOLOGO=1', '-e', 'DOTNET_CLI_TELEMETRY_OPTOUT=1',
    'mcr.microsoft.com/dotnet/sdk:10.0', 'dotnet', ...args,
  ]);
}

function node() {
  const todos = ficheiros(dir);
  const testes = todos
    .filter((f) => /\.test\.(js|ts)$/.test(f))
    .filter((f) => relative(dir, f).includes(filtro));
  const testesJsx = todos
    .filter((f) => /\.test\.jsx$/.test(f))
    .filter((f) => relative(dir, f).includes(filtro));

  if (testes.length === 0 && testesJsx.length === 0) {
    console.error(`Nenhum ficheiro de teste em ${pasta} corresponde a "${filtro}".`);
    return 1;
  }

  let estado = 0;
  // TypeScript: primeiro os tipos. Um erro de tipos é um erro, mesmo que o código "corra".
  // Só verificamos os testes escolhidos (e o que eles importam): assim, um exercício que ainda não
  // começaste não te enche o ecrã de erros enquanto fazes outro.
  if (existsSync(join(dir, 'tsconfig.json'))) {
    const tsconfig = join(dir, '.tsconfig.verificar.json');
    writeFileSync(tsconfig, JSON.stringify({ extends: './tsconfig.json', include: testes.map((f) => relative(dir, f)) }));
    try {
      estado = correr(join(root, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', relative(root, tsconfig)]);
    } finally {
      rmSync(tsconfig);
    }
    if (estado !== 0) return estado;
  }
  if (testes.length > 0) {
    estado ||= correr(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=spec', ...testes.map((f) => relative(root, f))]);
  }
  if (testesJsx.length > 0) {
    estado ||= correr(join(root, 'node_modules', '.bin', 'vitest'), ['run', ...testesJsx.map((f) => relative(root, f))]);
  }
  return estado;
}

function playwright() {
  return correr(join(root, 'node_modules', '.bin', 'playwright'), [
    'test', '-c', relative(root, join(dir, 'playwright.config.js')), ...(filtro ? [filtro] : []),
  ]);
}

let estado;
if (existsSync(join(dir, 'pom.xml'))) estado = maven();
else if (existsSync(join(dir, 'playwright.config.js'))) estado = playwright();
else if (readdirSync(dir).some((f) => f.endsWith('.csproj'))) estado = dotnet();
else if (existsSync(join(dir, 'verificar.mjs'))) estado = correr(process.execPath, [join(dir, 'verificar.mjs'), filtro]);
else if (existsSync(join(dir, 'verificar.sh'))) estado = correr('bash', [join(dir, 'verificar.sh'), filtro], { cwd: dir });
else estado = node();

console.log(estado === 0 ? `\n✔ ${pasta}: tudo a passar.` : `\n✘ ${pasta}: ainda há testes a falhar (lê a primeira falha, não todas).`);
process.exit(estado);
