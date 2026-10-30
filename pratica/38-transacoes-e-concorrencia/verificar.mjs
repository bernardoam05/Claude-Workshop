#!/usr/bin/env node
// Verificador do módulo 38: arranca um Postgres a sério (num contentor), corre os testes contra ele,
// e apaga-o no fim. A concorrência precisa de várias ligações ao mesmo tempo, que o PGlite não tem.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const filtro = process.argv[2] ?? '';
const IMAGEM = 'postgres:16-alpine';
const NOME = `pratica-postgres-${process.pid}`;
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

const testes = readdirSync(aqui).filter((f) => f.endsWith('.test.js') && f.includes(filtro));
if (testes.length === 0) {
  console.error(`Nenhum ficheiro de teste corresponde a "${filtro}".`);
  process.exit(1);
}
if (docker('info').status !== 0) {
  console.error('O Docker não está a responder: estes testes precisam dele para o Postgres.');
  process.exit(1);
}

const r = docker('run', '-d', '--name', NOME, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=pratica', '-e', 'POSTGRES_DB=pratica', IMAGEM, '-c', 'max_connections=200');
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(1);
}
try {
  const porta = docker('port', NOME, '5432').stdout.split('\n')[0].split(':').pop();
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i++) {
    // O pg_isready responde antes de o Postgres estar mesmo pronto a aceitar consultas; um SELECT confirma.
    pronto = docker('exec', NOME, 'psql', '-U', 'postgres', '-d', 'pratica', '-c', 'SELECT 1').status === 0;
    if (!pronto) spawnSync('sleep', ['0.5']);
  }
  if (!pronto) throw new Error('o Postgres não arrancou a tempo');
  const t = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', ...testes], {
    cwd: aqui,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `postgres://postgres:pratica@127.0.0.1:${porta}/pratica` },
  });
  process.exitCode = t.status ?? 1;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  docker('rm', '-f', NOME);
}
