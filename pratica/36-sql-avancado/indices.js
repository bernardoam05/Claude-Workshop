// P3 · Índices escolhidos a partir das consultas (e confirmados com o EXPLAIN).

// As três consultas mais frequentes da aplicação (não as mudes):
export const CONSULTAS = {
  recentesDoUtilizador: "SELECT * FROM tarefas WHERE utilizador = 'u42' ORDER BY criada_em DESC LIMIT 20",
  abertasDoProjeto: "SELECT * FROM tarefas WHERE projeto = 'p7' AND concluida_em IS NULL",
  porEmail: "SELECT * FROM utilizadores WHERE lower(email) = lower('Pessoa123@Exemplo.PT')",
};

// criarIndices(db): cria os índices que fazem estas três consultas usar um índice, com NO MÁXIMO
//   três índices novos (um por consulta, cada um à medida):
//   - recentesDoUtilizador: um índice composto que serve o filtro E a ordenação (sem passo de Sort)
//   - abertasDoProjeto: um índice PARCIAL, só com as tarefas abertas (são poucas; as concluídas,
//     a maioria, não ocupam espaço no índice)
//   - porEmail: um índice sobre uma EXPRESSÃO (lower(email)), senão o lower() impede o uso do índice
export async function criarIndices(db) {
  throw new Error('Por fazer: P3');
}
