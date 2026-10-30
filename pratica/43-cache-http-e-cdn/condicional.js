// P2 · Pedidos condicionais: ETag, Last-Modified e o 304 Not Modified.
import { createHash } from 'node:crypto';

// etag(corpo) → '"<hash>"': os primeiros 16 caracteres do SHA-1 do corpo em base64url, entre aspas
//   (um ETag "forte": muda sempre que o conteúdo muda).
export function etag(corpo) {
  throw new Error('Por fazer: P2');
}

// corresponde(ifNoneMatch, atual) → true se o cabeçalho If-None-Match corresponder ao ETag atual
//   O cabeçalho pode ter uma lista ('"a", W/"b"') ou '*' (qualquer um). A comparação é "fraca":
//   ignora o prefixo W/ dos dois lados.
export function corresponde(ifNoneMatch, atual) {
  throw new Error('Por fazer: P2');
}

// responder(req, res, { corpo, modificadoEm, cacheControl, tipo = 'application/json' })
//   Envia SEMPRE os cabeçalhos ETag, Last-Modified (modificadoEm, um Date, em toUTCString()) e
//   Cache-Control. Depois:
//   - se o pedido tiver If-None-Match: 304 sem corpo se corresponder, senão 200 com o corpo
//     (o If-Modified-Since é IGNORADO quando há If-None-Match)
//   - senão, se tiver If-Modified-Since e o recurso não tiver mudado desde essa data (comparando
//     ao segundo, que é a precisão do cabeçalho): 304 sem corpo
//   - senão: 200 com o corpo e o Content-Type
//   Só se aplica a GET e HEAD; outros métodos recebem sempre 200 (num HEAD, o 200 vai sem corpo).
export function responder(req, res, { corpo, modificadoEm, cacheControl, tipo = 'application/json' }) {
  throw new Error('Por fazer: P2');
}
