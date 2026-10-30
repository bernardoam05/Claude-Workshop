// P3 · Bloqueio otimista: sem bloquear nada, detetar que alguém mudou o registo entretanto.
//
// Tabela: notas (id INT PRIMARY KEY, titulo TEXT, versao INT NOT NULL DEFAULT 1)

export class Conflito extends Error {}

// atualizarTitulo(pool, id, titulo, versaoLida) → a nova versão
//   UPDATE ... SET titulo = $2, versao = versao + 1 WHERE id = $1 AND versao = $3 RETURNING versao
//   Se não atualizou nada (alguém mudou a nota depois de a leres, ou não existe): lança um Conflito.
export async function atualizarTitulo(pool, id, titulo, versaoLida) {
  throw new Error('Por fazer: P3');
}

// acrescentarAoTitulo(pool, id, sufixo, { tentativas = 5 }) → o título final
//   Lê a nota (titulo e versao), calcula titulo + sufixo, e tenta atualizar com a versão lida.
//   Num Conflito, volta a LER e tenta outra vez (até `tentativas`); esgotadas, o Conflito propaga-se.
export async function acrescentarAoTitulo(pool, id, sufixo, { tentativas = 5 } = {}) {
  throw new Error('Por fazer: P3');
}
