// P3 · O padrão "transactional outbox": a resposta ao dual-write (secção 11).
//
// createTask(db, title)
//   Numa só transação: insere a tarefa E uma linha na outbox com
//     routing_key = 'task.created'
//     payload     = { type: 'task.created', task: { id, title } }
//   Devolve a tarefa { id, title }. Se qualquer um dos INSERT falhar, nenhum fica.
//
// relayOnce(db, publisher, { batchSize = 10 } = {})
//   Lê até batchSize eventos por publicar (os mais antigos primeiro), publica-os por ordem com
//   publisher.publish(routingKey, payload) e marca cada um como publicado (published_at = now())
//   logo a seguir a publicá-lo. Se um publish falhar, PARA aí (não salta para o seguinte, para não
//   trocar a ordem) e não lança erro: o resto fica para a próxima volta.
//   Devolve { published: <quantos publicou nesta volta> }.
export async function createTask(db, title) {
  throw new Error('Por fazer: P3');
}

export async function relayOnce(db, publisher, { batchSize = 10 } = {}) {
  throw new Error('Por fazer: P3');
}
