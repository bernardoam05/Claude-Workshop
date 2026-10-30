// P2 · Testes de contrato orientados pelo consumidor (a ideia do Pact, em pequeno).
// O frontend (consumidor) escreve o que espera da API (fornecedor) num contrato. O contrato serve
// para duas coisas: um fornecedor FALSO para os testes do consumidor, e uma verificação do
// fornecedor VERDADEIRO nos testes da API. Se a API mudar algo de que o frontend depende, parte aqui.
//
// Um contrato: [{ descricao, pedido: { metodo, caminho }, resposta: { estado, corpo } }]
// O corpo da resposta é um "matcher":
//   { $tipo: 'texto' | 'numero' | 'booleano', $exemplo? }   → qualquer valor desse tipo
//   { $regex: '^\\d{4}-\\d{2}-\\d{2}$', $exemplo }          → um texto que corresponde
//   { $cadaUm: matcher, $min = 1 }                            → um array com pelo menos $min elementos, todos a corresponder
//   um objeto normal                                           → um objeto com (pelo menos) essas chaves, cada uma a
//                                                                corresponder; chaves a mais são permitidas (o
//                                                                consumidor só exige o que usa)
//   outro valor (texto, número, booleano, null)                → exatamente esse valor

const TIPOS = { texto: 'string', numero: 'number', booleano: 'boolean' };
const descrever = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

// verificarValor(valor, matcher, caminho = '$') → lista de erros, cada um a começar pelo caminho
//   onde falhou ('$.tarefas[1].id: ...'). [] se corresponder.
export function verificarValor(valor, matcher, caminho = '$') {
  throw new Error('Por fazer: P2');
}

// exemplo(matcher) → um valor de exemplo que corresponde ao matcher:
//   $tipo → o $exemplo se houver, senão 'texto' / 1 / true; $regex → o $exemplo;
//   $cadaUm → $min (ou 1) cópias do exemplo do elemento; objeto → o exemplo de cada chave; outro → ele próprio
export function exemplo(matcher) {
  throw new Error('Por fazer: P2');
}

// fornecedorFalso(contrato) → async ({ metodo, caminho }) → { estado, corpo }
//   Para os testes do CONSUMIDOR: responde às interações do contrato com os exemplos. Um pedido
//   que não está no contrato → { estado: 500, corpo: { erro: 'Pedido fora do contrato: GET /x' } }
//   (assim o consumidor não pode usar nada que o contrato não diga).
export function fornecedorFalso(contrato) {
  throw new Error('Por fazer: P2');
}

// verificarFornecedor(contrato, fornecedor) → lista de erros (para os testes do FORNECEDOR)
//   Faz cada pedido do contrato ao fornecedor verdadeiro (async (pedido) → { estado, corpo }) e
//   compara. Cada erro começa por '<descricao>: '. Um estado diferente dá
//   '<descricao>: estado esperado 200, veio 404' (e não se verifica o corpo).
export async function verificarFornecedor(contrato, fornecedor) {
  throw new Error('Por fazer: P2');
}
