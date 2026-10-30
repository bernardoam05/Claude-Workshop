// P1 · Genéricos. Ver docs/29-typescript.md, secção "Prática".
// Escreve as ASSINATURAS (é o exercício) e os corpos. Os testes verificam os tipos que inferes.

// agruparPor(itens, chave): agrupa os itens pela chave que a função devolve.
//   agruparPor([{ e: "a" }, { e: "b" }, { e: "a" }], (x) => x.e) → { a: [..2], b: [..1] }
//   Tipo: T qualquer; K tem de servir de chave de objeto (PropertyKey); devolve Partial<Record<K, T[]>>
//   (Partial, porque nem todos os K possíveis aparecem)
export function agruparPor(itens, chave) {
  throw new Error('Por fazer: P1');
}

// escolher(obj, chaves): um objeto novo só com essas chaves.
//   escolher({ id: 1, titulo: "x", feita: false }, ["id", "titulo"]) → { id: 1, titulo: "x" }
//   Tipo: as chaves TÊM de existir em obj (K extends keyof T); devolve Pick<T, K>
export function escolher(obj, chaves) {
  throw new Error('Por fazer: P1');
}

// semNulos(lista): tira os null e undefined. O tipo do resultado já não os tem:
//   semNulos([1, null, 2, undefined]) é number[] (usa um type guard no filter: (x): x is T => ...)
export function semNulos(lista) {
  throw new Error('Por fazer: P1');
}

// mapearValores(obj, fn): aplica fn a cada valor, mantendo as chaves.
//   mapearValores({ a: 1, b: 2 }, (n) => String(n)) → { a: "1", b: "2" }, do tipo { a: string; b: string }
//   Tipo: um "mapped type" { [K in keyof T]: R }
export function mapearValores(obj, fn) {
  throw new Error('Por fazer: P1');
}
