#!/usr/bin/env node
// Verificador do módulo 35: arranca uma "AWS" local (o LocalStack, em Docker), corre os testes
// contra ela, e apaga-a no fim. Chamado por `npm run verificar 35 [filtro]`.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const filtro = process.argv[2] ?? '';
const IMAGEM = 'localstack/localstack:4.10';
const NOME = `pratica-localstack-${process.pid}`;
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

const testes = readdirSync(aqui).filter((f) => f.endsWith('.test.js') && f.includes(filtro));
if (testes.length === 0) {
  console.error(`Nenhum ficheiro de teste corresponde a "${filtro}".`);
  process.exit(1);
}

// A política IAM (P4) não precisa do LocalStack: é só ler um JSON.
const precisaAws = testes.some((f) => f !== 'politica.test.js');
let url = '';
if (precisaAws) {
  if (docker('info').status !== 0) {
    console.error('O Docker não está a responder: estes testes precisam dele para o LocalStack.');
    process.exit(1);
  }
  console.log(`(A arrancar o LocalStack, ${IMAGEM}: a primeira vez descarrega ~1,8 GB)`);
  const r = docker('run', '-d', '--name', NOME, '-p', '127.0.0.1::4566', '-e', 'SERVICES=s3,sqs,dynamodb', IMAGEM);
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  const porta = docker('port', NOME, '4566').stdout.split('\n')[0].split(':').pop();
  url = `http://127.0.0.1:${porta}`;
  // Espera até os três serviços estarem prontos (até ~60 s).
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    const saude = spawnSync('curl', ['-sf', `${url}/_localstack/health`], { encoding: 'utf8' });
    try {
      const s = JSON.parse(saude.stdout).services;
      pronto = ['s3', 'sqs', 'dynamodb'].every((x) => ['available', 'running'].includes(s[x]));
    } catch {}
    if (!pronto) spawnSync('sleep', ['0.5']);
  }
  if (!pronto) {
    console.error('O LocalStack não arrancou a tempo. Logs:\n' + docker('logs', '--tail', '20', NOME).stderr);
    docker('rm', '-f', NOME);
    process.exit(1);
  }
}

const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...testes], {
  cwd: aqui,
  stdio: 'inherit',
  env: { ...process.env, LOCALSTACK_URL: url },
});
if (precisaAws) docker('rm', '-f', NOME);
process.exit(r.status ?? 1);
