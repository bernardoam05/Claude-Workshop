// P4 · Direitos dos titulares (acesso e apagamento) e prazos de conservação, numa base de dados.
// Esquema (criado pelos testes):
//   utilizadores(id, email, nome)
//   tarefas(id, utilizador_id, titulo)
//   faturas(id, utilizador_id NULL, nif, valor, emitida_em)   -- obrigação legal: guardar 10 anos
//   acessos(id, utilizador_id, ip, em)                          -- logs de acesso

// exportarDados(db, id) → { utilizador, tarefas, faturas, acessos } (direito de acesso, art. 15.º)
//   utilizador: a linha do utilizador (ou lança um Error se não existir)
//   as outras: as linhas desse utilizador, ordenadas por id
export async function exportarDados(db, id) {
  throw new Error('Por fazer: P4');
}

// apagarTitular(db, id) → { tarefas, acessos, faturasAnonimizadas } (direito ao apagamento, art. 17.º)
//   Numa transação: apaga as tarefas e os acessos; as faturas NÃO se apagam (a lei obriga a
//   guardá-las), mas deixam de apontar para o utilizador (utilizador_id = NULL); por fim apaga o
//   utilizador. Devolve quantas linhas de cada tipo foram afetadas.
export async function apagarTitular(db, id) {
  throw new Error('Por fazer: P4');
}

// aplicarRetencao(db, { agora, diasAcessos = 90 }) → quantos acessos apagou
//   Apaga os acessos com `em` anterior a (agora − diasAcessos dias). agora é um texto ISO.
export async function aplicarRetencao(db, { agora, diasAcessos = 90 }) {
  throw new Error('Por fazer: P4');
}
