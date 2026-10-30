// P3 · Um trace que atravessa serviços: o cabeçalho traceparent.
import { context, propagation, trace } from '@opentelemetry/api'; // eslint-disable-line no-unused-vars
import http from 'node:http'; // eslint-disable-line no-unused-vars

// lerTraceparent(valor) → { versao, traceId, spanId, amostrado } ou null se for inválido.
//   Formato (W3C Trace Context): "00-<trace id: 32 hex>-<span id: 16 hex>-<flags: 2 hex>"
//   Ex.: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
//   - só minúsculas; trace id e span id não podem ser só zeros; versão "ff" é inválida
//   - amostrado: o bit mais baixo das flags (01 → true, 00 → false)
export function lerTraceparent(valor) {
  throw new Error('Por fazer: P3');
}

// criarServicoStock() → um http.Server (sem listen) que, a cada pedido:
//   - extrai o contexto dos cabeçalhos (propagation.extract(context.active(), req.headers))
//   - nesse contexto, cria um span ativo "stock: GET /stock" (filho do span de quem chamou)
//   - responde 200 com JSON { traceId } (o trace id do seu span) e termina o span
export function criarServicoStock() {
  throw new Error('Por fazer: P3');
}

// consultarStock(url) → o JSON da resposta
//   - num span ativo "loja: consultar-stock", injeta o contexto atual num objeto de cabeçalhos
//     (propagation.inject(context.active(), cabecalhos)) e faz fetch(url, { headers: cabecalhos })
//   - termina o span no fim
export async function consultarStock(url) {
  throw new Error('Por fazer: P3');
}
