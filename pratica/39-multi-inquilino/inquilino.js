// P1 · Descobrir o inquilino (o cliente, a organização) de cada pedido.

export class ErroInquilino extends Error {}

// resolverInquilino(pedido, { dominioBase, validos }) → o id do inquilino (texto)
//   pedido: { anfitriao: 'acme.tarefas.pt:443', cabecalhos: { 'x-inquilino': ... }, token: { inquilino } | null }
//   As fontes possíveis:
//   - o subdomínio: anfitriao (sem a porta, em minúsculas) = '<sub>.<dominioBase>', com <sub> sem
//     pontos (o próprio dominioBase, ou outros domínios, não dão subdomínio)
//   - o cabeçalho 'x-inquilino'
//   - o token autenticado (token.inquilino)
//   Regras (todas com ErroInquilino):
//   - as fontes presentes têm de concordar entre si; valores diferentes → mensagem com 'conflito'
//     (um utilizador da acme não pode pedir dados da globex mudando um cabeçalho)
//   - nenhuma fonte → mensagem com 'Sem inquilino'
//   - um inquilino que não está em `validos` (um Set) → mensagem com 'desconhecido'
export function resolverInquilino(pedido, { dominioBase, validos }) {
  throw new Error('Por fazer: P1');
}
