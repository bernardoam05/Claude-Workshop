// P1 · Erros com um formato padrão: "Problem Details" (RFC 9457).

export class ErroValidacao extends Error {
  constructor(erros) {
    super('Dados inválidos');
    this.erros = erros; // [{ campo, mensagem }]
  }
}
export class NaoEncontrado extends Error {}
export class Conflito extends Error {}

// paraProblema(erro, { instancia }) → { status, corpo }
//   corpo segue o RFC 9457: { type, title, status, detail?, instance, ...extensões }
//   - ErroValidacao → 422, type 'https://tarefas.pt/problemas/validacao', title 'Dados inválidos',
//                     e a extensão errors: [{ campo, mensagem }] (os erros do objeto)
//   - NaoEncontrado → 404, type '.../nao-encontrado', title 'Não encontrado', detail = a mensagem do erro
//   - Conflito      → 409, type '.../conflito', title 'Conflito', detail = a mensagem
//   - outro erro    → 500, type 'about:blank', title 'Erro interno', SEM detail (a mensagem de um
//                     erro inesperado pode ter detalhes internos: SQL, caminhos, segredos)
//   instance: o caminho do pedido (vem nas opções)
//   Só incluas detail quando existe.
const BASE = 'https://tarefas.pt/problemas/';
export function paraProblema(erro, { instancia }) {
  throw new Error('Por fazer: P1');
}

// enviarProblema(res, erro, instancia): escreve a resposta num http.ServerResponse do Node, com
//   o estado, o Content-Type 'application/problem+json' e o corpo em JSON.
export function enviarProblema(res, erro, instancia) {
  throw new Error('Por fazer: P1');
}
