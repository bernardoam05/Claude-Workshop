// P3 · Regeneração estática incremental (ISR): páginas geradas uma vez e servidas da cache,
// regeneradas em segundo plano quando ficam velhas (o stale-while-revalidate do módulo 43, no servidor).

// criarCachePaginas({ gerar, revalidar, agora = Date.now }) → { obter(caminho), invalidar(caminho) }
//   gerar: async (caminho) → html     revalidar: segundos     agora: relógio em milissegundos
//   obter(caminho) → Promise de { html, estado }:
//   - não há nada em cache → gera, guarda, 'MISS' (pedidos em paralelo para o mesmo caminho
//     esperam pela MESMA geração)
//   - em cache há menos de `revalidar` segundos → 'HIT'
//   - em cache há mais → devolve LOGO o html velho com 'STALE', e começa a regenerar em segundo
//     plano (uma só regeneração de cada vez por caminho). Quando acabar, a cache fica com o novo
//     (a contar de quando acabou). Se a regeneração falhar, fica o velho, e tenta-se no pedido seguinte.
//   invalidar(caminho): apaga o caminho da cache (o próximo pedido é um MISS); é o
//     revalidatePath do Next.js, chamado depois de uma escrita.
export function criarCachePaginas({ gerar, revalidar, agora = Date.now }) {
  throw new Error('Por fazer: P3');
}
