// P1 · Um logger estruturado (JSON, uma linha por evento). Ver docs/47-observabilidade-otel.md, secção "Prática".
import { trace } from '@opentelemetry/api'; // eslint-disable-line no-unused-vars

// criarLogger({ nivel = "info", escrever, agora = () => new Date(), base = {} })
//   → { debug(msg, campos), info(...), warn(...), error(...), filho(campos) }
//
// Cada chamada que passe o nível mínimo (debug < info < warn < error) escreve UMA linha com
// escrever(linha), sendo a linha o JSON.stringify de, por esta ordem:
//   { ts: agora().toISOString(), nivel, msg, ...base, ...campos, trace_id, span_id }
// - trace_id e span_id só aparecem se houver um span ativo (trace.getActiveSpan()): é o que liga
//   os logs aos traces
// - campos sensíveis, a QUALQUER profundidade, ficam "[REDACTED]": password, senha, token,
//   authorization e cookie (sem distinguir maiúsculas: "Authorization" também)
// - um valor que seja um Error vira { nome, mensagem, stack }
// - filho(campos) devolve um logger igual, com esses campos acrescentados à base (ex.: o id do pedido)
// escrever, por omissão, escreve no stdout com uma quebra de linha.
export function criarLogger({ nivel = 'info', escrever = (l) => process.stdout.write(`${l}\n`), agora = () => new Date(), base = {} } = {}) {
  throw new Error('Por fazer: P1');
}
