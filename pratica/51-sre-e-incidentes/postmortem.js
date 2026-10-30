// P4 · Um verificador de postmortems.

export const SECOES = ['Resumo', 'Impacto', 'Cronologia', 'Causas', 'Ações'];

// Expressões que procuram um culpado em vez de uma causa. Um postmortem "sem culpas" (blameless)
// pergunta o que no SISTEMA deixou o erro acontecer, não quem o cometeu.
export const EXPRESSOES_DE_CULPA = ['culpa d', 'erro humano', 'devia ter', 'não devia', 'descuido', 'negligência'];

// verificarPostmortem(markdown) → lista de problemas (texto); [] se estiver tudo bem
//   1. Cada secção de SECOES tem de existir como título de nível 2 ("## Resumo"). Por cada uma que
//      falte: "Falta a secção: Resumo".
//   2. Cada linha da secção "Ações" que seja uma tarefa ("- [ ] ..." ou "- [x] ...") tem de ter um
//      dono e uma data, no formato "(@dono, AAAA-MM-DD)". Senão: "Ação sem dono ou data: <texto da linha sem '- [ ] '>".
//   3. A secção "Ações" tem de ter pelo menos uma tarefa: "Sem ações".
//      (se a secção não existir, só aparece o problema 1)
//   4. Por cada expressão de EXPRESSOES_DE_CULPA que apareça no texto (sem distinguir maiúsculas),
//      uma vez: "Linguagem de culpa: <expressão>".
export function verificarPostmortem(markdown) {
  throw new Error('Por fazer: P4');
}
