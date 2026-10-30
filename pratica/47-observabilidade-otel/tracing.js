// P2 · Spans: medir o que acontece dentro de um pedido, passo a passo.
import { SpanStatusCode, trace } from '@opentelemetry/api'; // eslint-disable-line no-unused-vars

export const tracer = trace.getTracer('notas');

// comSpan(nome, atributos, fn) → o resultado de fn(span)
//   - tracer.startActiveSpan(nome, ...): o span fica ATIVO enquanto fn corre, por isso os spans criados
//     lá dentro ficam automaticamente seus filhos
//   - põe os atributos no span (span.setAttributes)
//   - se fn lançar um erro: span.recordException(erro), estado ERROR com a mensagem do erro, e o erro
//     propaga-se
//   - o span termina SEMPRE (span.end()), com sucesso ou com erro
export async function comSpan(nome, atributos, fn) {
  throw new Error('Por fazer: P2');
}

// processarEncomenda(encomenda, { validar, cobrar, notificar }) → "concluida"
//   Um span "processar-encomenda" (atributos: "encomenda.id" e "encomenda.total") com três filhos,
//   por esta ordem: "validar", "cobrar" e "notificar", cada um a chamar a função com o mesmo nome.
//   - se validar ou cobrar falharem, a encomenda falha (o erro propaga-se)
//   - se notificar falhar, a encomenda NÃO falha: o span "notificar" fica com o erro, e o span
//     "processar-encomenda" ganha um evento "notificacao-falhou" (span.addEvent)
export async function processarEncomenda(encomenda, { validar, cobrar, notificar }) {
  throw new Error('Por fazer: P2');
}
