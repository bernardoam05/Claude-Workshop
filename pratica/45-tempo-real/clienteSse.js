// P2 · Ler um stream SSE à mão (o que o EventSource do browser faz por ti).

// lerEventos(url, aoEvento, { signal, ultimoId }) → Promise que termina quando o stream acaba
//   - fetch(url, { headers: { Accept: "text/event-stream", e "Last-Event-ID" se houver ultimoId }, signal })
//   - lê o corpo aos bocados (for await ... of resposta.body, com um TextDecoder), junta-os, e
//     separa por linhas. Os eventos podem chegar partidos a meio entre dois bocados!
//   - linhas começadas por ":" são comentários: ignora
//   - "campo: valor" (o espaço depois dos dois pontos é opcional e não faz parte do valor):
//       event → o tipo · id → o id · data → acrescenta uma linha aos dados (várias linhas data juntam-se com "\n")
//   - uma linha em branco termina o evento: chama aoEvento({ evento, dados, id }) (evento por omissão:
//     "message"; id: o último recebido, mesmo que venha de um evento anterior) e recomeça
//   - um evento sem nenhuma linha data não é entregue
export async function lerEventos(url, aoEvento, { signal, ultimoId } = {}) {
  throw new Error('Por fazer: P2');
}
