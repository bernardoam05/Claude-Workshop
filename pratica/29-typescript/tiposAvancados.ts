// P3 · Tipos condicionais, mapeados, template literals, marcas e asserções.

// ParcialProfundo<T>: como Partial<T>, mas em todos os níveis (objetos dentro de objetos também
// ficam opcionais). Os arrays e as funções ficam como estão.
export type ParcialProfundo<T> = unknown;

// ChavesDoTipo<T, V>: as chaves de T cujo valor é do tipo V.
//   ChavesDoTipo<{ id: number; titulo: string; nota: string }, string> = "titulo" | "nota"
export type ChavesDoTipo<T, V> = unknown;

// Rotas tipadas com template literal types:
export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';
//   Rota: qualquer texto que comece por "/api/"
export type Rota = unknown;
//   Endpoint: "<Metodo> <Rota>", ex.: "GET /api/tarefas"
export type Endpoint = unknown;

// Um tipo "com marca": um número que o compilador distingue de um number qualquer, para não se
// passar um id de utilizador onde se espera um id de tarefa.
//   IdTarefa = number & { readonly __marca: "IdTarefa" }
export type IdTarefa = unknown;
// idTarefa(n): a ÚNICA forma de criar um IdTarefa: valida (inteiro positivo, senão Error) e devolve-o.
export function idTarefa(n) {
  throw new Error('Por fazer: P3');
}

// afirmarTexto(x: unknown): uma "assertion function": se x não for uma string, lança um Error; depois
// de a chamares, o compilador sabe que x é uma string (asserts x is string).
export function afirmarTexto(x) {
  throw new Error('Por fazer: P3');
}
