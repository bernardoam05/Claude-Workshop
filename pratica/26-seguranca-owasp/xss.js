// P2 · Cross-Site Scripting (OWASP A03). O servidor gera HTML com texto escrito por utilizadores.
//
// Corrige as duas funções:
//   - escaparHtml(texto): devolve o texto com & < > " ' trocados por &amp; &lt; &gt; &quot; &#39;
//     (o & PRIMEIRO: porquê?)
//   - renderizarComentario({ autor, texto, site }): usa o escaparHtml em TUDO o que vem do
//     utilizador; o link só aparece se o site começar por http:// ou https:// (nada de javascript:).
//     Sem site válido, o autor aparece sem link.
export function escaparHtml(texto) {
  return String(texto);
}

export function renderizarComentario({ autor, texto, site }) {
  const nome = site ? `<a href="${site}">${autor}</a>` : autor;
  return `<article class="comentario"><h3>${nome}</h3><p>${texto}</p></article>`;
}
