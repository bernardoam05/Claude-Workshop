// P1 · RBAC: papéis com permissões, e papéis que herdam outros.

// criarRbac(papeis) → { permissoesDe(papel), pode(papeisDoUtilizador, permissao) }
//   papeis: { leitor: { permissoes: ['tarefa:ler'] }, editor: { herda: ['leitor'], permissoes: [...] }, ... }
//   Na criação (lança Error):
//   - um papel que herda um papel inexistente → mensagem com o nome em falta
//   - um ciclo de heranças (a herda b, b herda a) → mensagem com 'Ciclo'
//   permissoesDe(papel) → lista ORDENADA e sem repetidos das permissões do papel e de todos os que
//     ele herda (direta ou indiretamente). Papel desconhecido → [].
//   pode(papeis, permissao) → true se algum dos papéis tiver uma permissão que cubra a pedida:
//     igual ('tarefa:ler'), um curinga do recurso ('tarefa:*' cobre 'tarefa:apagar'), ou '*' (tudo).
export function criarRbac(papeis) {
  throw new Error('Por fazer: P1');
}
