// P4 · Invalidar: nomes com hash para os ficheiros estáticos, e purgas por etiqueta numa CDN.
import { createHash } from 'node:crypto';

// nomeComHash(nome, conteudo) → 'app.3f2a9c1b.js': os primeiros 8 caracteres hexadecimais do
//   SHA-256 do conteúdo, antes da ÚLTIMA extensão. Sem extensão: 'LICENSE' → 'LICENSE.3f2a9c1b'.
//   Com pastas: 'js/app.min.js' → 'js/app.min.<hash>.js'.
export function nomeComHash(nome, conteudo) {
  throw new Error('Por fazer: P4');
}

// reescreverReferencias(html, mapa) → o html com cada atributo src="..." ou href="..." cujo valor
//   esteja no mapa (nome original → nome com hash) trocado. Os outros ficam como estão.
export function reescreverReferencias(html, mapa) {
  throw new Error('Por fazer: P4');
}

// criarCdn() → { guardar(url, corpo, etiquetas = []), obter(url), purgarUrl(url), purgarEtiqueta(etiqueta), get tamanho }
//   Uma CDN de brincar: guardar associa o url às etiquetas (as "surrogate keys" / "cache tags":
//   ex.: a página de uma tarefa tem as etiquetas ['tarefa:42', 'projeto:7']).
//   obter → o corpo guardado, ou undefined
//   purgarUrl → 1 se apagou, 0 se não havia
//   purgarEtiqueta → quantos urls apagou (todos os que tinham a etiqueta)
//   Voltar a guardar um url substitui o corpo E as etiquetas.
export function criarCdn() {
  throw new Error('Por fazer: P4');
}
