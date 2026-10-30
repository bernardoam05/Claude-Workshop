// P4 · Trocar condicionais por dados: o switch de maquinaLegado.js passa a uma TABELA de
// transições. As regras ficam visíveis num só sítio, e coisas novas (que ações são possíveis
// agora? que estados se conseguem alcançar?) saem da tabela sem mais switches.

// TRANSICOES: { [estado]: { [acao]: novoEstado } }, com exatamente as mesmas transições do legado.
export const TRANSICOES = {};

// seguinte(estado, acao) → o novo estado; uma transição que não existe lança o MESMO erro que o
//   legado: Error('Ação "<acao>" impossível no estado "<estado>"'). Cuidado com nomes como
//   'toString' ou 'constructor', que existem em qualquer objeto.
export function seguinte(estado, acao) {
  throw new Error('Por fazer: P4');
}

// acoesPossiveis(estado) → as ações possíveis nesse estado, por ordem alfabética ([] se não existir)
export function acoesPossiveis(estado) {
  throw new Error('Por fazer: P4');
}

// alcancaveis(desde) → os estados a que se consegue chegar a partir de `desde` com zero ou mais
//   ações (inclui o próprio), por ordem alfabética
export function alcancaveis(desde) {
  throw new Error('Por fazer: P4');
}
