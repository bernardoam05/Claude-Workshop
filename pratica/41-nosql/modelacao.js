// P3 · Modelar documentos: embutir com limite, e versões de esquema migradas ao ler.

// projetoComTarefas(projeto, tarefas, { maxEmbutidas }) → o documento do projeto, pronto a guardar
//   Embutir TODAS as tarefas faria o documento crescer sem limite (o MongoDB recusa documentos com
//   mais de 16 MB, e cada leitura traria tudo). O "padrão do subconjunto": embute só as
//   maxEmbutidas mais recentes (por criadaEm, da mais recente para a mais antiga), só com
//   { id, titulo }, e guarda o total. As restantes ficam na sua própria coleção.
//   → { ...projeto, tarefasRecentes: [{ id, titulo }, ...], totalTarefas }
//   Só contam as tarefas com tarefa.projeto === projeto.id.
export function projetoComTarefas(projeto, tarefas, { maxEmbutidas }) {
  throw new Error('Por fazer: P3');
}

// O "padrão das versões do esquema": os documentos antigos não se migram todos de uma vez; cada
// documento diz a sua versão (versaoEsquema; sem o campo é a 1) e migra-se quando é lido.
//   v1 → v2: o campo 'nome' passou a chamar-se 'titulo'
//   v2 → v3: 'tags' era um texto separado por vírgulas ('a, b'); passou a ser um array (['a', 'b']),
//            sem espaços nas pontas e sem elementos vazios ('' → [])
// migrarAoLer(doc) → um documento NOVO na versão 3 (com versaoEsquema: 3), aplicando os passos
//   que faltam por ordem. Uma versão maior do que 3 lança um Error (código antigo a ler dados novos).
export const VERSAO_ATUAL = 3;
export function migrarAoLer(doc) {
  throw new Error('Por fazer: P3');
}
