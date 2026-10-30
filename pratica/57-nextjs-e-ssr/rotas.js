// P1 · Rotas a partir de ficheiros, como no App Router do Next.js.

// criarRouter(ficheiros) → { resolver(caminho) → { ficheiro, params } | null }
//   ficheiros: caminhos como 'app/tarefas/[id]/page.js'. Só contam os que acabam em '/page.js';
//   'app/page.js' é a rota '/'.
//   Segmentos da pasta:
//     'tarefas'       → estático: tem de ser igual
//     '[id]'          → dinâmico: apanha UM segmento → params.id (texto, com decodeURIComponent)
//     '[...partes]'   → apanha tudo: UM ou mais segmentos → params.partes (lista)
//     '[[...partes]]' → apanha tudo, opcional: ZERO ou mais → params.partes (lista, possivelmente vazia)
//     '(marketing)'   → grupo: organiza as pastas mas NÃO aparece no URL
//   Quando várias rotas servem, ganha a mais específica, segmento a segmento, da esquerda para
//   a direita: estático > dinâmico > apanha-tudo > apanha-tudo opcional.
//   O caminho pode ter ou não '/' no fim ('/tarefas/' = '/tarefas').
const PESO = { estatico: 0, dinamico: 1, tudo: 2, opcional: 3 };

// Sugestão: uma função que transforma o caminho de um ficheiro numa lista de segmentos
// ({ tipo, nome } ou { tipo: 'estatico', valor }), e outra que tenta encaixar essa lista nas
// partes do URL, devolvendo os params ou null.

export function criarRouter(ficheiros) {
  throw new Error('Por fazer: P1');
}
