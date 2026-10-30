// P3 · Um agente: o modelo pede para usar ferramentas, o teu código executa-as, e o ciclo repete-se.
//
// FERRAMENTAS: a definição (o que o modelo vê). Escreve a da ferramenta "procurar_tarefas":
//   descrição: "Procura as tarefas do utilizador. Usa-a sempre que a pergunta for sobre tarefas."
//   input_schema: um objeto com "estado" (string, enum ["feitas", "por_fazer", "todas"], obrigatório)
//   strict: true, e additionalProperties: false
export const FERRAMENTAS = [];

// responderComFerramentas(cliente, pergunta, { procurarTarefas, maxVoltas = 5 })
//   → { resposta, chamadas }
//   - começa com [{ role: "user", content: pergunta }]
//   - em cada volta: messages.create (modelo "claude-opus-5-5", max_tokens 4096, tools: FERRAMENTAS)
//   - stop_reason "end_turn" → acabou: resposta = o texto dos blocos "text"
//   - stop_reason "tool_use" → acrescenta a resposta inteira (content) como mensagem "assistant";
//     executa CADA bloco tool_use (procurarTarefas(input.estado), que pode ser assíncrono e devolve um
//     array); e responde com UMA mensagem "user" com TODOS os tool_result:
//       { type: "tool_result", tool_use_id: <o id do bloco>, content: JSON.stringify(resultado) }
//     Se a ferramenta lançar um erro (ou o nome for desconhecido), o tool_result leva
//     is_error: true e content com a mensagem do erro (o modelo decide o que fazer com isso).
//   - qualquer outro stop_reason ("max_tokens", "refusal"...): Error com o stop_reason na mensagem
//   - mais de maxVoltas pedidos: Error com "voltas" (um agente sem limite pode gastar dinheiro sem fim)
//   - chamadas: quantas ferramentas foram executadas no total
export async function responderComFerramentas(cliente, pergunta, { procurarTarefas, maxVoltas = 5 }) {
  throw new Error('Por fazer: P3');
}
