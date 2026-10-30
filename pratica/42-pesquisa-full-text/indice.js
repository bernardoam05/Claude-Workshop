// P2 · Um índice invertido: para cada termo, a lista dos documentos onde aparece (e quantas vezes).

const tokenizarSimples = (texto) => texto.toLowerCase().split(/\W+/).filter(Boolean);

// criarIndice(tokenizar = tokenizarSimples) → {
//   adicionar(id, texto)   indexa o documento; se o id já existir, substitui-o (remove o antigo primeiro)
//   remover(id)            tira o documento de todos os termos (e apaga os termos que ficarem vazios)
//   frequencias(termo)     → Map id → quantas vezes o termo aparece nesse documento (vazio se nenhum)
//   pesquisar(consulta, { modo = 'e' })
//                          → ids ordenados (crescente) dos documentos com TODOS os termos da
//                            consulta ('e') ou com PELO MENOS UM ('ou'). Consulta sem termos → [].
//   get termos             → quantos termos diferentes há no índice
// }
//   A consulta passa pelo mesmo tokenizar que os documentos.
export function criarIndice(tokenizar = tokenizarSimples) {
  throw new Error('Por fazer: P2');
}
