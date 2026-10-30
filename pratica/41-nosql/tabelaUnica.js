// P4 · Desenho de tabela única (DynamoDB): as chaves desenham-se a partir dos padrões de acesso.
//
// Padrões de acesso que a tabela tem de servir, cada um com UMA consulta:
//   A. um projeto e todas as suas tarefas                → PK = PROJ#<id>
//   B. os projetos de um utilizador                      → índice GSI1, GSI1PK = USER#<dono>, SK começa por PROJ#
//   C. as tarefas de um utilizador num estado, por prazo → GSI1, GSI1PK = USER#<responsavel>, SK começa por TAREFA#<estado>#

// chaves(item) → o item com as chaves acrescentadas:
//   { tipo: 'projeto', id, nome, dono }
//     → PK 'PROJ#<id>', SK 'META', GSI1PK 'USER#<dono>', GSI1SK 'PROJ#<id>'
//   { tipo: 'tarefa', id, projeto, responsavel, estado, prazo ('2026-11-01') }
//     → PK 'PROJ#<projeto>', SK 'TAREFA#<id>', GSI1PK 'USER#<responsavel>', GSI1SK 'TAREFA#<estado>#<prazo>'
//   outro tipo → lança um Error
export function chaves(item) {
  throw new Error('Por fazer: P4');
}

// consultar(itens, { indice, pk, skComeca, crescente = true, limite }) → itens
//   Imita a operação Query do DynamoDB sobre uma lista de itens (já com chaves):
//   - indice: undefined → usa PK/SK; 'GSI1' → usa GSI1PK/GSI1SK (itens sem essas chaves não estão no índice)
//   - pk: igualdade exata na chave de partição (obrigatória: uma Query nunca percorre a tabela toda)
//   - skComeca: opcional, a chave de ordenação começa por este texto (o begins_with)
//   - ordena pela chave de ordenação (texto), crescente ou decrescente, e corta em `limite`
export function consultar(itens, { indice, pk, skComeca, crescente = true, limite }) {
  throw new Error('Por fazer: P4');
}
