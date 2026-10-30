// P2 · Paginação por cursor (keyset): estável e rápida, ao contrário do OFFSET.
// Tabela (criada pelos testes): tarefas(id int, titulo text, criada_em timestamptz)
// Ordem: as mais recentes primeiro (criada_em DESC), com o id a desempatar (id DESC).

export class ErroCursor extends Error {}

// codificarCursor({ criadaEm, id }) → texto base64url do JSON { c: criadaEm, i: id }
// descodificarCursor(texto) → { criadaEm, id }, ou lança ErroCursor se não for um cursor válido
//   (não descodifica, não é JSON, ou faltam os campos: c tem de ser um texto e i um inteiro)
export function codificarCursor({ criadaEm, id }) {
  throw new Error('Por fazer: P2');
}
export function descodificarCursor(texto) {
  throw new Error('Por fazer: P2');
}

// pagina(db, { limite = 20, depois }) → { itens: [{ id, titulo }], proximo }
//   limite: inteiro de 1 a 100 (senão ErroCursor com 'limite' na mensagem)
//   depois: o cursor devolvido pela página anterior (ou nada para a primeira)
//   proximo: o cursor da última linha devolvida, ou null se não houver mais nada
//   Faz UMA consulta com a condição (criada_em, id) < (cursor) e LIMIT limite + 1 (a linha a mais
//   diz se há próxima página, sem um COUNT). O cursor guarda criada_em em texto ISO (toISOString).
export async function pagina(db, { limite = 20, depois } = {}) {
  throw new Error('Por fazer: P2');
}
