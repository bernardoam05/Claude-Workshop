// P2 · ABAC: decisões a partir de atributos do sujeito, do recurso e do contexto.

// avaliar(politicas, pedido) → { permitido, motivo }
//   pedido: { sujeito, acao, recurso, contexto }
//   politicas: [{ id, efeito: 'permitir' | 'negar', acoes: ['editar', ...] ou ['*'], condicao?: (pedido) => boolean }]
//   Uma política aplica-se se a ação estiver nas suas acoes (ou houver '*') e a condição (se
//   existir) der true. Regras:
//   - se uma condição LANÇAR um erro → { permitido: false, motivo: 'erro em <id>' } (falhar fechado)
//   - alguma 'negar' aplicável → { permitido: false, motivo: <id da primeira> } (negar ganha sempre)
//   - senão, alguma 'permitir' aplicável → { permitido: true, motivo: <id da primeira> }
//   - senão → { permitido: false, motivo: 'nenhuma política' } (negado por omissão)
export function avaliar(politicas, pedido) {
  throw new Error('Por fazer: P2');
}
