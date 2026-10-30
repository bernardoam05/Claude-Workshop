// P4 · Autorização dentro das consultas: filtrar no SQL, e não carregar tudo e filtrar em memória.
// Tabelas (criadas pelos testes):
//   tarefas(id, titulo, dono, projeto_id)
//   membros(projeto_id, utilizador, papel)   -- papel: 'leitor' | 'editor'
//   partilhas(tarefa_id, utilizador)
// Regras: um utilizador { id, admin } VÊ uma tarefa se for admin, o dono, membro do projeto (qualquer
// papel) ou se a tarefa tiver sido partilhada com ele. EDITA se for admin, o dono, ou editor do projeto.

// tarefasVisiveis(db, utilizador) → as tarefas que ele vê, por id, com UMA só consulta
export async function tarefasVisiveis(db, { id, admin }) {
  throw new Error('Por fazer: P4');
}

// podeVer(db, utilizador, tarefaId) → true/false (as MESMAS regras: tem de bater sempre com a lista)
export async function podeVer(db, utilizador, tarefaId) {
  throw new Error('Por fazer: P4');
}

// podeEditar(db, utilizador, tarefaId) → true/false
export async function podeEditar(db, { id, admin }, tarefaId) {
  throw new Error('Por fazer: P4');
}
