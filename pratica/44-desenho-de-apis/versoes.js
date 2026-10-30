// P3 · Versões de uma API e mudanças que partem (ou não) os clientes.

// As versões que a API conhece. A v1 está obsoleta (deprecated) e tem data para desligar (sunset).
export const VERSOES = {
  1: { obsoleta: true, desligaEm: '2027-03-31' },
  2: { obsoleta: false },
};
export const ATUAL = 2;

// escolherVersao(cabecalhos) → { versao, cabecalhosResposta }
//   A versão vem do cabeçalho 'api-version' ('1', '2') ou do tipo de media no 'accept'
//   ('application/vnd.tarefas.v1+json'); o 'api-version' tem prioridade. Sem nenhum → ATUAL.
//   Uma versão que não existe em VERSOES → lança um Error com 'Versão' na mensagem.
//   cabecalhosResposta: sempre { 'API-Version': '<n>' }; numa versão obsoleta, também
//   'Deprecation': 'true' e 'Sunset': a data de desligar em formato HTTP (new Date(...).toUTCString()).
export function escolherVersao(cabecalhos) {
  throw new Error('Por fazer: P3');
}

// paraVersao(tarefa, versao) → a tarefa no formato dessa versão. O modelo interno (= v2) é
//   { id, titulo, estado: 'aberta' | 'em_curso' | 'feita', etiquetas: [...] }.
//   A v1 tinha { id, title, done: boolean } (sem etiquetas; done é estado === 'feita').
export function paraVersao(tarefa, versao) {
  throw new Error('Por fazer: P3');
}

// partePedidos(mudanca) → true se a mudança PARTE clientes existentes (exige uma versão nova).
//   mudanca: { tipo, onde: 'pedido' | 'resposta', obrigatorio? }
//   tipos: 'campo-novo', 'campo-removido', 'campo-renomeado', 'tipo-alterado', 'valor-enum-novo'
//   Regras:
//   - remover, renomear ou mudar o tipo de um campo: parte sempre
//   - campo novo na resposta: não parte (os clientes ignoram o que não conhecem)
//   - campo novo no pedido: só parte se for obrigatório
//   - valor novo num enum: na RESPOSTA parte (um cliente com um switch sobre os valores não o
//     conhece); no PEDIDO não parte (é uma opção a mais)
export function partePedidos({ tipo, onde, obrigatorio = false }) {
  throw new Error('Por fazer: P3');
}
