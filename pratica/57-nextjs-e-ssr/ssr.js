// P2 · Renderizar no servidor (SSR) e passar os dados ao cliente sem abrir uma porta a XSS.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

// escaparHtml(texto) → o texto com & < > " ' trocados pelas entidades (&amp; &lt; &gt; &quot; &#39;)
export function escaparHtml(texto) {
  throw new Error('Por fazer: P2');
}

// serializarDados(dados) → JSON seguro para pôr dentro de um <script> no HTML.
//   JSON.stringify sozinho NÃO chega: um texto com '</script>' fecharia o script e o resto seria
//   HTML (XSS). Troca '<' por '<', '>' por '>', '&' por '&', e os separadores
//   de linha U+2028 e U+2029 pelas suas sequências \u2028 e \u2029. O resultado continua a ser
//   JSON válido que dá os mesmos dados com JSON.parse.
export function serializarDados(dados) {
  throw new Error('Por fazer: P2');
}

// renderizarDocumento({ componente, props, titulo }) → o HTML completo da página:
//   <!doctype html><html lang="pt"><head><meta charset="utf-8"><title>TITULO</title></head>
//   <body><div id="raiz">HTML_DO_COMPONENTE</div>
//   <script id="__DADOS__" type="application/json">DADOS</script>
//   <script type="module" src="/cliente.js"></script></body></html>
//   (tudo seguido, sem quebras de linha nem espaços entre as etiquetas)
//   TITULO escapado com escaparHtml; HTML_DO_COMPONENTE = renderToString(createElement(componente, props));
//   DADOS = serializarDados(props), para o cliente "hidratar" com os mesmos props.
export function renderizarDocumento({ componente, props, titulo }) {
  throw new Error('Por fazer: P2');
}
