import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escaparHtml, renderizarComentario } from './xss.js';

describe('P2 · escaparHtml', () => {
  it('troca os cinco caracteres especiais do HTML', () => {
    assert.equal(escaparHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  it('não escapa duas vezes o que acabou de escapar (o & tem de ser o primeiro)', () => {
    assert.equal(escaparHtml('<'), '&lt;');
    assert.equal(escaparHtml('&lt;'), '&amp;lt;');
  });

  it('aceita números e não mexe em texto normal', () => {
    assert.equal(escaparHtml(42), '42');
    assert.equal(escaparHtml('Olá, mundo'), 'Olá, mundo');
  });
});

describe('P2 · renderizarComentario', () => {
  it('uso normal: autor com link e texto', () => {
    assert.equal(
      renderizarComentario({ autor: 'Ana', texto: 'Gostei!', site: 'https://ana.pt' }),
      '<article class="comentario"><h3><a href="https://ana.pt">Ana</a></h3><p>Gostei!</p></article>',
    );
  });

  it('um <script> no texto aparece como texto, não corre', () => {
    const html = renderizarComentario({ autor: 'x', texto: '<script>roubar(document.cookie)</script>' });
    assert.ok(!html.includes('<script>'), html);
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('o autor também é escapado (um <img onerror=...> não vira uma imagem)', () => {
    const html = renderizarComentario({ autor: '<img src=x onerror=alert(1)>', texto: 'a' });
    assert.ok(!html.includes('<img'), html);
  });

  it('um site com aspas não consegue fechar o atributo href e acrescentar outro', () => {
    const html = renderizarComentario({ autor: 'x', texto: 'a', site: 'https://a.pt" onmouseover="alert(1)' });
    assert.ok(!html.includes('" onmouseover="'), html);
  });

  it('um link javascript: não aparece (o autor fica sem link)', () => {
    for (const site of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>']) {
      const html = renderizarComentario({ autor: 'x', texto: 'a', site });
      assert.ok(!html.includes('<a '), `${site} → ${html}`);
    }
  });
});
