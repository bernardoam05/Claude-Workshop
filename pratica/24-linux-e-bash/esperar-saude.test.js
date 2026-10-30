import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { comecado } from './ajuda.js';

const SCRIPT = fileURLToPath(new URL('./esperar-saude.sh', import.meta.url));

// Um servidor que responde 503 nos primeiros N pedidos e 200 depois.
async function servidor(falhasAntes) {
  let pedidos = 0;
  const s = http.createServer((req, res) => {
    pedidos++;
    res.writeHead(pedidos <= falhasAntes ? 503 : 200).end('ok');
  });
  s.listen(0);
  await once(s, 'listening');
  return { url: `http://127.0.0.1:${s.address().port}/health`, pedidos: () => pedidos, fechar: () => s.close() };
}

// Corre o script de forma assíncrona (o servidor está neste mesmo processo, por isso não pode ser spawnSync).
async function correr(args, env = {}) {
  const p = spawn('bash', [SCRIPT, ...args], { env: { ...process.env, ESPERA_BASE: '0.1', ...env } });
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', (d) => (stdout += d));
  p.stderr.on('data', (d) => (stderr += d));
  const inicio = Date.now();
  const [codigo] = await once(p, 'close');
  return { codigo, stdout, stderr, ms: Date.now() - inicio };
}

describe('P4 · esperar-saude.sh', () => {
  it('saudável à primeira: "saudável" e código 0, sem esperar', async () => {
    assert.ok(comecado('esperar-saude.sh'), 'ainda não começaste o esperar-saude.sh');
    const s = await servidor(0);
    try {
      const r = await correr([s.url]);
      assert.equal(r.codigo, 0, r.stderr);
      assert.equal(r.stdout.trim(), 'saudável');
      assert.equal(s.pedidos(), 1);
    } finally {
      s.fechar();
    }
  });

  it('tenta de novo com backoff até ficar saudável, e regista cada falha', async () => {
    const s = await servidor(2);
    try {
      const r = await correr([s.url, '5']);
      assert.equal(r.codigo, 0, r.stderr);
      assert.equal(s.pedidos(), 3);
      assert.match(r.stderr, /tentativa 1\/5: 503/);
      assert.match(r.stderr, /tentativa 2\/5: 503/);
      assert.ok(r.ms >= 280, `devia ter esperado 0,1 + 0,2 s entre tentativas (esperou ${r.ms} ms)`);
    } finally {
      s.fechar();
    }
  });

  it('desiste ao fim das tentativas, com código 1', async () => {
    const s = await servidor(99);
    try {
      const r = await correr([s.url, '3']);
      assert.equal(r.codigo, 1);
      assert.equal(s.pedidos(), 3);
      assert.match(r.stderr, /desisti/);
      assert.equal(r.stdout, '');
    } finally {
      s.fechar();
    }
  });

  it('um serviço que nem responde conta como 000', async () => {
    const r = await correr(['http://127.0.0.1:9/health', '2']);
    assert.equal(r.codigo, 1);
    assert.match(r.stderr, /tentativa 1\/2: 000/);
  });

  it('a espera dobra mas nunca passa de 4x a base', async () => {
    const s = await servidor(99);
    try {
      // 6 tentativas → esperas de 0,1 0,2 0,4 0,4 0,4 = 1,5 s (sem teto seriam 3,1 s)
      const r = await correr([s.url, '6']);
      assert.ok(r.ms >= 1400 && r.ms < 2600, `esperou ${r.ms} ms no total`);
    } finally {
      s.fechar();
    }
  });
});
