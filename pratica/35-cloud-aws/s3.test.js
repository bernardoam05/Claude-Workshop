import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aws, unico } from './ajuda.js';
import { garantirBucket, guardar, ler, linkTemporario, listar } from './s3.js';

describe('P1 · S3', () => {
  it('garantirBucket cria o bucket, e chamá-la outra vez não dá erro', async () => {
    const { s3 } = aws();
    const b = unico('notas');
    await garantirBucket(s3, b);
    await garantirBucket(s3, b);
    await guardar(s3, b, 'x.txt', 'x', 'text/plain');
    assert.equal(await ler(s3, b, 'x.txt'), 'x');
  });

  it('guarda e lê, com acentos; uma chave que não existe dá null', async () => {
    const { s3 } = aws();
    const b = unico('notas');
    await garantirBucket(s3, b);
    await guardar(s3, b, 'uploads/ana/nota.md', '# Ação\nConteúdo', 'text/markdown');
    assert.equal(await ler(s3, b, 'uploads/ana/nota.md'), '# Ação\nConteúdo');
    assert.equal(await ler(s3, b, 'nao/existe.md'), null);
  });

  it('lista por prefixo, seguindo as páginas', async () => {
    const { s3 } = aws();
    const b = unico('notas');
    await garantirBucket(s3, b);
    for (const k of ['uploads/ana/c.md', 'uploads/ana/a.md', 'uploads/bruno/x.md', 'uploads/ana/b.md', 'uploads/ana/e.md', 'uploads/ana/d.md']) {
      await guardar(s3, b, k, k, 'text/plain');
    }
    assert.deepEqual(await listar(s3, b, 'uploads/ana/'), ['uploads/ana/a.md', 'uploads/ana/b.md', 'uploads/ana/c.md', 'uploads/ana/d.md', 'uploads/ana/e.md']);
    assert.deepEqual(await listar(s3, b, 'uploads/carla/'), []);
  });

  it('um link temporário descarrega o ficheiro sem credenciais, com o tipo certo', async () => {
    const { s3 } = aws();
    const b = unico('notas');
    await garantirBucket(s3, b);
    await guardar(s3, b, 'relatorio.json', '{"ok":true}', 'application/json');
    const url = await linkTemporario(s3, b, 'relatorio.json', 60);
    assert.match(url, /X-Amz-Signature=/, 'um URL pré-assinado leva a assinatura nos parâmetros');
    assert.match(url, /X-Amz-Expires=60/);
    const r = await fetch(url);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/json');
    assert.equal(await r.text(), '{"ok":true}');
  });
});
