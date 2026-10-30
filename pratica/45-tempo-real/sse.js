// P1 · Server-Sent Events do lado do servidor. Ver docs/45-tempo-real.md, secção "Prática".

// formatarEvento({ evento, dados, id }) → o texto de UM evento SSE:
//   - "id: <id>\n" se houver id
//   - "event: <evento>\n" se houver evento
//   - os dados: se não forem string, JSON.stringify; CADA linha dos dados vira "data: <linha>\n"
//   - e uma linha em branco no fim ("\n"), que é o que marca o fim do evento
//   formatarEvento({ evento: "tarefa", dados: { id: 1 }, id: 7 }) → 'id: 7\nevent: tarefa\ndata: {"id":1}\n\n'
export function formatarEvento({ evento, dados, id }) {
  throw new Error('Por fazer: P1');
}

// new Difusor({ guardar = 50, batimentoMs = 15000 })
//   ligar(req, res): responde 200 com os cabeçalhos de SSE
//       Content-Type: text/event-stream · Cache-Control: no-cache · Connection: keep-alive
//     e regista o cliente. Se o pedido trouxer o cabeçalho Last-Event-ID (o browser envia-o sozinho
//     quando volta a ligar), reenvia-lhe primeiro os eventos guardados com id MAIOR do que esse.
//     A cada batimentoMs, escreve um comentário ": ping\n\n" (proxies e balanceadores fecham ligações
//     paradas). Quando o cliente fecha (req.on("close")), deixa de lhe enviar e para o batimento.
//   publicar(evento, dados): dá ao evento o próximo id (1, 2, 3...), guarda-o (só os últimos `guardar`)
//     e envia-o a todos os clientes ligados
//   get clientes(): quantos clientes estão ligados
export class Difusor {
  constructor({ guardar = 50, batimentoMs = 15000 } = {}) {
    throw new Error('Por fazer: P1');
  }
}
