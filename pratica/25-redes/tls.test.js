import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import tls from 'node:tls';
import { inspecionar } from './tls.js';

// Um certificado autoassinado, criado com o openssl para cada execução dos testes.
function certificado() {
  const dir = mkdtempSync(join(tmpdir(), 'pratica32-'));
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
    '-keyout', join(dir, 'chave.pem'), '-out', join(dir, 'cert.pem'),
    '-subj', '/CN=servidor.teste', '-addext', 'subjectAltName=DNS:servidor.teste,DNS:localhost',
  ], { stdio: 'ignore' });
  return { key: readFileSync(join(dir, 'chave.pem')), cert: readFileSync(join(dir, 'cert.pem')) };
}

async function servidorTls() {
  const credenciais = certificado();
  const s = tls.createServer(credenciais, (socket) => socket.end('olá'));
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  return { porta: s.address().port, cert: credenciais.cert, fechar: () => s.close() };
}

describe('P4 · inspecionar (TLS)', () => {
  it('lê o certificado: sujeito, emissor, nomes, validade e protocolo', async () => {
    const s = await servidorTls();
    try {
      const r = await inspecionar({ host: '127.0.0.1', porta: s.porta, servername: 'servidor.teste' });
      assert.equal(r.sujeito, 'servidor.teste');
      assert.equal(r.emissor, 'servidor.teste', 'num certificado autoassinado, o emissor é o próprio');
      assert.deepEqual(r.nomes, ['servidor.teste', 'localhost']);
      assert.ok(r.validoAte instanceof Date);
      const dias = (r.validoAte - Date.now()) / 86_400_000;
      assert.ok(dias > 28 && dias < 31, `válido por ~30 dias (são ${dias.toFixed(1)})`);
      assert.equal(r.protocolo, 'TLSv1.3');
    } finally {
      s.fechar();
    }
  });

  it('um certificado autoassinado não é de confiança... ', async () => {
    const s = await servidorTls();
    try {
      const r = await inspecionar({ host: '127.0.0.1', porta: s.porta, servername: 'servidor.teste' });
      assert.equal(r.autorizado, false);
      assert.equal(r.erro, 'DEPTH_ZERO_SELF_SIGNED_CERT');
    } finally {
      s.fechar();
    }
  });

  it('...a menos que digamos que confiamos nele (ca)', async () => {
    const s = await servidorTls();
    try {
      const r = await inspecionar({ host: '127.0.0.1', porta: s.porta, servername: 'servidor.teste', ca: s.cert });
      assert.equal(r.autorizado, true);
      assert.equal(r.erro, null);
    } finally {
      s.fechar();
    }
  });
});
