import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement as h } from 'react';
import { escaparHtml, renderizarDocumento, serializarDados } from './ssr.js';

const Lista = ({ tarefas }) => h('ul', null, tarefas.map((t) => h('li', { key: t.id }, t.titulo)));
const perigoso = '</script><script>alert(1)</script>';

describe('P2 · escaparHtml', () => {
  it('troca os cinco caracteres especiais', () => {
    assert.equal(escaparHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  });
});

describe('P2 · serializarDados', () => {
  it('não deixa fechar o script', () => {
    const s = serializarDados({ titulo: perigoso });
    assert.ok(!s.includes('<'), s);
    assert.ok(!s.includes('>'), s);
    assert.deepEqual(JSON.parse(s), { titulo: perigoso });
  });
  it('escapa & e os separadores de linha, e continua a ser JSON', () => {
    const dados = { a: 'x & y', b: 'linha\u2028nova\u2029', c: [1, null, true] };
    const s = serializarDados(dados);
    assert.ok(!/[&\u2028\u2029]/.test(s), s);
    assert.match(s, /\\u2028/);
    assert.deepEqual(JSON.parse(s), dados);
  });
});

describe('P2 · renderizarDocumento', () => {
  const props = { tarefas: [{ id: 1, titulo: 'Rever PR' }, { id: 2, titulo: perigoso }] };
  const html = renderizarDocumento({ componente: Lista, props, titulo: 'Tarefas <2>' });

  it('o HTML já traz o conteúdo (o utilizador e os motores de pesquisa veem-no sem JavaScript)', () => {
    assert.ok(html.startsWith('<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Tarefas &lt;2&gt;</title></head>'), html);
    assert.ok(html.includes('<div id="raiz"><ul><li>Rever PR</li>'), html);
    assert.ok(html.endsWith('<script type="module" src="/cliente.js"></script></body></html>'));
  });
  it('o React escapa o texto, e os dados embutidos não abrem um script', () => {
    assert.equal((html.match(/<script/g) ?? []).length, 2, 'só os dois scripts esperados');
    assert.ok(html.includes('&lt;/script&gt;'));
  });
  it('o cliente consegue ler os mesmos dados', () => {
    const m = /<script id="__DADOS__" type="application\/json">(.*?)<\/script>/.exec(html);
    assert.ok(m, 'falta o script com os dados');
    assert.deepEqual(JSON.parse(m[1]), props);
  });
});
