// P1 · Tipos de eventos com uma "discriminated union", e a validação em runtime que lhes corresponde.
// Escreve tudo neste ficheiro (os tipos e as funções), com `export`. Ver docs/07-worker.md, "Prática".
//
// Tipos:
//   TaskSnapshot   → { id: number; title: string; done: boolean; userId: number }
//   TaskCreated    → eventId (string), occurredAt (string), type: 'task.created',   task: TaskSnapshot
//   TaskCompleted  → eventId, occurredAt,                   type: 'task.completed', task: TaskSnapshot
//   TaskDeleted    → eventId, occurredAt,                   type: 'task.deleted',   taskId: number, userId: number
//                    (um evento de "apagada" não traz a tarefa: ela já não existe)
//   TaskEvent      → qualquer um dos três
//
// Funções:
//   isTaskEvent(value: unknown): value is TaskEvent
//       verifica em runtime a forma completa, incluindo os campos específicos de cada tipo
//   describeEvent(event: TaskEvent): string
//       'Tarefa 3 criada: "Estudar TS"' · 'Tarefa 3 concluída: "Estudar TS"' · 'Tarefa 3 apagada'
//       com um `switch` que o compilador garante ser exaustivo (ver a pista no módulo).
