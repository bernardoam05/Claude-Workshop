// P2 · Streaming e conversas com várias voltas.

// transmitir(cliente, historico, aoReceber) → Promise<{ resposta, historico, tokens }>
//   historico: o array de mensagens até agora (a API não guarda nada: envias a conversa TODA
//   em cada pedido). A última é a pergunta do utilizador.
//   - pede com cliente.messages.stream (modelo "claude-opus-5-5", max_tokens 4096)
//   - chama aoReceber(pedaço) para CADA pedaço de texto, à medida que chega
//   - no fim (finalMessage), devolve:
//       resposta: o texto completo
//       historico: um array NOVO = o histórico recebido + { role: "assistant", content: <o content
//                  completo da resposta> } (não alteres o array que recebeste)
//       tokens: os output_tokens da resposta
export async function transmitir(cliente, historico, aoReceber) {
  throw new Error('Por fazer: P2');
}

// comTentativas(fn, { tentativas = 3, espera = (n) => 2 ** n * 100 }) → o resultado de fn()
// Repete fn() quando falha com um erro TEMPORÁRIO da API: Anthropic.RateLimitError (429),
// Anthropic.InternalServerError (>= 500) ou Anthropic.APIConnectionError. Entre tentativas, espera
// espera(n) milissegundos (n = 0, 1, 2...). Qualquer outro erro (ex.: 400, um pedido mal feito)
// propaga-se logo, sem repetir. Esgotadas as tentativas, propaga o último erro.
export async function comTentativas(fn, { tentativas = 3, espera = (n) => 2 ** n * 100 } = {}) {
  throw new Error('Por fazer: P2');
}
