// P4 · Expandir/contrair: mudar o esquema da base de dados sem parar a aplicação.
// Exemplo: renomear tarefas.nome para tarefas.titulo, com a versão antiga e a nova a correr ao mesmo tempo.

// expandir(db): acrescenta a coluna titulo (texto, PODE ser NULL, para a versão antiga, que não
//   a conhece, continuar a conseguir inserir).
export async function expandir(db) {
  throw new Error('Por fazer: P4');
}

// criarV2(db, titulo) → id: o que a versão nova da aplicação faz para criar uma tarefa durante a
//   transição: escreve nas DUAS colunas (escrita dupla), para a versão antiga continuar a ler o nome.
export async function criarV2(db, titulo) {
  throw new Error('Por fazer: P4');
}

// preencher(db, { lote }) → quantas linhas atualizou no total
//   Copia nome para titulo nas linhas em que titulo ainda é NULL, em lotes de `lote` linhas por
//   UPDATE (numa tabela grande, um UPDATE único bloquearia tudo durante muito tempo), até não haver mais.
export async function preencher(db, { lote }) {
  throw new Error('Por fazer: P4');
}

// contrair(db): só depois de nenhuma versão antiga estar a correr.
//   Se ainda houver linhas com titulo NULL, lança um Error e não muda nada.
//   Senão, numa transação: titulo passa a NOT NULL e a coluna nome é apagada.
export async function contrair(db) {
  throw new Error('Por fazer: P4');
}
