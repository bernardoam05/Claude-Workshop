import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lerAnexo, validarUrlExterna } from './ficheirosEUrls.js';

const ANEXOS = fileURLToPath(new URL('./anexos', import.meta.url));

// Tem de ser o TEU erro (com "anexo" na mensagem), e não um ENOENT de um ficheiro que por acaso
// não existe: esse ENOENT quer dizer que o código tentou mesmo abrir o caminho perigoso.
const recusado = (promessa) =>
  assert.rejects(promessa, (err) => {
    assert.equal(err.code, undefined, `o código tentou abrir o ficheiro (${err.code}): a verificação tem de vir ANTES`);
    assert.match(err.message, /anexo/);
    return true;
  });

describe('P4 · lerAnexo (path traversal)', () => {
  it('lê um anexo que está na pasta', async () => {
    assert.equal(await lerAnexo(ANEXOS, 'fatura.txt'), 'Fatura de outubro: 42 €\n');
  });

  it('não sai da pasta com ../', async () => {
    await recusado(lerAnexo(ANEXOS, '../ficheirosEUrls.js'));
    await recusado(lerAnexo(ANEXOS, '../../../../../../etc/passwd'));
  });

  it('não aceita caminhos absolutos', async () => {
    await recusado(lerAnexo(ANEXOS, '/etc/passwd'));
  });

  it('não se deixa enganar por uma pasta "irmã" com o mesmo início do nome', async () => {
    // /x/anexos-privados começa por "/x/anexos", mas NÃO está dentro de /x/anexos
    await recusado(lerAnexo(ANEXOS, '../anexos-privados/x.txt'));
  });
});

describe('P4 · validarUrlExterna (SSRF)', () => {
  it('aceita um URL https público', () => {
    assert.equal(validarUrlExterna('https://exemplo.pt/img.png').hostname, 'exemplo.pt');
  });

  it('recusa outros protocolos', () => {
    for (const u of ['http://exemplo.pt/', 'file:///etc/passwd', 'gopher://exemplo.pt/', 'ftp://exemplo.pt/']) {
      assert.throws(() => validarUrlExterna(u), /URL/, u);
    }
  });

  it('recusa a própria máquina e a rede interna', () => {
    for (const u of [
      'https://localhost/',
      'https://LOCALHOST:8443/',
      'https://127.0.0.1/',
      'https://127.1.2.3/',
      'https://10.0.0.5/',
      'https://172.16.0.1/',
      'https://172.31.255.255/',
      'https://192.168.1.1/',
      'https://169.254.169.254/latest/meta-data/',
      'https://0.0.0.0/',
      'https://[::1]/',
    ]) {
      assert.throws(() => validarUrlExterna(u), /URL/, u);
    }
  });

  it('não bloqueia IPs públicos parecidos (172.32 e 11.x são públicos)', () => {
    assert.doesNotThrow(() => validarUrlExterna('https://172.32.0.1/'));
    assert.doesNotThrow(() => validarUrlExterna('https://11.0.0.1/'));
  });

  it('um URL inválido também é recusado com uma mensagem sobre o URL', () => {
    assert.throws(() => validarUrlExterna('isto não é um url'), /URL/);
  });
});
