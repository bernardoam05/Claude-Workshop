// P3 · Um consumidor novo, como pede a secção 8: notifica o dono quando uma tarefa é concluída.
// Ver docs/07-worker.md, "Prática".
//
// Exporta:
//   interface Queryable  → { query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> }
//   type Notify          → (userId: number, text: string) => Promise<void>
//   type HandleResult    → 'notificado' | 'duplicado' | 'ignorado'
//   class MalformedEventError extends Error
//   createNotificationHandler(deps: { db: Queryable; notify: Notify })
//       → devolve handle(value: unknown): Promise<HandleResult>
//
// handle(value):
//   1. não é um TaskEvent → lança MalformedEventError
//   2. não é 'task.completed' → 'ignorado' (sem tocar na BD)
//   3. INSERT INTO notifications (event_id, user_id, text) VALUES ($1, $2, $3)
//        ON CONFLICT (event_id) DO NOTHING RETURNING event_id
//      sem linha devolvida → 'duplicado' (já tínhamos notificado: não notificar outra vez)
//   4. notify(userId, `Concluíste "<título>"`) → 'notificado'
//      se o notify falhar: DELETE FROM notifications WHERE event_id = $1, e volta a lançar o erro
//      (para a próxima entrega da mensagem poder notificar; sem isto, a notificação perdia-se)
