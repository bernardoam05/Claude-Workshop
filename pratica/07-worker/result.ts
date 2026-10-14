// P2 · Erros como valores: um tipo Result genérico, em vez de lançar exceções.
// Escreve tudo neste ficheiro, com `export`. Ver docs/07-worker.md, "Prática".
//
//   type Result<T, E = string>    → { ok: true; value: T } | { ok: false; error: E }
//   ok(value)                      → um Result de sucesso
//   err(error)                     → um Result de falha
//   map(result, fn)                → aplica fn ao valor se for sucesso; uma falha passa intacta
//   partition(results)             → { values: [...valores dos sucessos], errors: [...erros das falhas] }
//   parseEvent(buffer: Buffer): Result<TaskEvent>
//       nunca lança: devolve err('JSON inválido') ou err('formato de evento inválido')
//       (usa o isTaskEvent do P1)
