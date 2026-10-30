// P2 · Esquema partilhado com uma coluna de inquilino, e um repositório que nunca a esquece.

// criarEsquema(db): cria as tabelas
//   projetos(inquilino text, id int, nome text)          chave primária (inquilino, id)
//   tarefas(inquilino text, id int, projeto_id int, titulo text)   chave primária (inquilino, id)
//   com uma chave estrangeira COMPOSTA (inquilino, projeto_id) → projetos(inquilino, id): assim é
//   impossível uma tarefa da acme apontar para um projeto da globex, mesmo com o id certo.
export async function criarEsquema(db) {
  throw new Error('Por fazer: P2');
}

// repositorio(db, inquilino) → { criarProjeto(id, nome), criarTarefa(id, projetoId, titulo),
//                                 tarefas(), tarefa(id), apagarTarefa(id) }
//   Todas as operações só veem e mexem nos dados DESTE inquilino:
//   tarefas() → [{ id, projeto_id, titulo }] por id; tarefa(id) → { id, projeto_id, titulo } ou null;
//   apagarTarefa(id) → true se apagou, false se não havia (incluindo se for de outro inquilino).
//   O inquilino tem de ser um texto não vazio; senão, lança um Error logo na criação.
export function repositorio(db, inquilino) {
  throw new Error('Por fazer: P2');
}
