// P1 · Deploy canário: escolher quem vai para a versão nova, e decidir se ela é promovida.

// balde(id, sal = '') → um número inteiro de 0 a 99, sempre o mesmo para o mesmo id e sal
//   Usa o hash FNV-1a de 32 bits do texto `${sal}:${id}`, e o resto da divisão por 100.
//   (FNV-1a: h = 2166136261; por cada código de carácter c: h = (h XOR c) × 16777619, em 32 bits
//   sem sinal. Em JS: h ^= c; h = Math.imul(h, 16777619) >>> 0.)
//   Estável é o que importa: o mesmo utilizador fica sempre do mesmo lado, em todos os servidores.
export function balde(id, sal = '') {
  throw new Error('Por fazer: P1');
}

// naVersaoNova(id, percentagem, sal) → true se o balde do id for menor do que a percentagem
//   (0 → ninguém; 100 → toda a gente; ao subir de 5 para 20, quem já estava continua).
export function naVersaoNova(id, percentagem, sal = '') {
  throw new Error('Por fazer: P1');
}

// avaliarCanario({ base, canario }, opcoes) → 'esperar' | 'reverter' | 'promover'
//   base e canario: { pedidos, erros, p99Ms } da versão atual e da nova, no mesmo período.
//   opcoes: { minPedidos = 500, margemErro = 0.005, fatorLatencia = 1.2 }
//   - 'esperar' se o canário ainda tiver menos de minPedidos (poucos dados para decidir)
//   - 'reverter' se a taxa de erros do canário passar a da base em mais de margemErro,
//      ou o p99 do canário for maior do que fatorLatencia × o p99 da base
//   - 'promover' no resto
export function avaliarCanario({ base, canario }, { minPedidos = 500, margemErro = 0.005, fatorLatencia = 1.2 } = {}) {
  throw new Error('Por fazer: P1');
}
