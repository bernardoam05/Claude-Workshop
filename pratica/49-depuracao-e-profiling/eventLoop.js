// P1 · Não bloquear o event loop.
import { pbkdf2 } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

// atrasoDoEventLoop(fn) → { maxMs, p99Ms }
//   Mede quanto o event loop se atrasou enquanto `await fn()` corria: usa monitorEventLoopDelay
//   com resolution 5 (ms), enable() antes, disable() depois, e lê h.max e h.percentile(99)
//   (em nanossegundos: converte para milissegundos).
export async function atrasoDoEventLoop(fn) {
  throw new Error('Por fazer: P1');
}

// hashSenhas(senhas, { sal, iteracoes }) → Promise com a lista de hashes (hex), pela mesma ordem
//   PBKDF2-SHA256, 32 bytes, com o sal e as iterações dados. Com a versão síncrona (pbkdf2Sync),
//   cada hash bloqueia o event loop dezenas de milissegundos e o servidor deixa de responder a
//   tudo o resto. Usa a versão assíncrona, que corre na thread pool do libuv.
export function hashSenhas(senhas, { sal, iteracoes }) {
  throw new Error('Por fazer: P1');
}
