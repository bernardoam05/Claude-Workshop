// P4 · O legado.js, migrado para TypeScript, com validação em tempo de execução (Zod).
import { z } from 'zod'; // eslint-disable-line @typescript-eslint/no-unused-vars

// EsquemaTarefa: um z.object com id (inteiro positivo), titulo (string não vazia), feita (booleano)
// e etiquetas (array de strings; se faltar, [] — usa .default([])).
// Os dados vêm de fora, em inglês: { id, title, done, tags }. Usa um esquema para a forma de FORA
// (EsquemaTarefaExterna) e transforma-a (.transform) na forma de DENTRO.
export const EsquemaTarefaExterna = undefined;

// Tarefa: o tipo, INFERIDO do esquema (z.infer / z.output), e não escrito à mão.
export type Tarefa = unknown;

// lerTarefas(json: string) → Tarefa[]. Se o JSON for inválido ou não cumprir o esquema, lança um Error.
export function lerTarefas(json) {
  throw new Error('Por fazer: P4');
}

// resumir(tarefas: readonly Tarefa[]) → { total: number; feitas: number; porEtiqueta: Record<string, number> }
export function resumir(tarefas) {
  throw new Error('Por fazer: P4');
}

// LIMITES: a configuração, com "satisfies": o compilador verifica que cumpre o tipo
// { maxTitulo: number; etiquetasPermitidas: readonly string[] }, MAS mantém os tipos exatos
// (maxTitulo fica do tipo 200, e etiquetasPermitidas readonly ["casa", "trabalho", "estudo"], e não string[]).
//   maxTitulo: 200, etiquetasPermitidas: ["casa", "trabalho", "estudo"] (as const)
export const LIMITES = undefined;
// Etiqueta: a união dos valores de LIMITES.etiquetasPermitidas ("casa" | "trabalho" | "estudo"),
// DERIVADA de LIMITES (typeof ...[number]), e não escrita à mão.
export type Etiqueta = unknown;
