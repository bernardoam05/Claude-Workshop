// P3 · Camada HTTP: traduz pedidos em chamadas ao serviço e erros em códigos HTTP.
// Não tem regras de negócio. Como src/api/src/routes/tasks.js.
//
// createNotesRouter(service) devolve um express.Router com:
//   GET    /notes        → 200 com a lista (query validada pelo listQuerySchema)
//   POST   /notes        → 201 com a nota criada
//   PATCH  /notes/:id    → 200 com a nota atualizada
//   DELETE /notes/:id    → 204 sem corpo
// O utilizador autenticado já está em req.user.userId (outro middleware tratou disso).
//
// Erros, sempre como {"error": "mensagem"}:
//   validação falhou (corpo, query ou :id) → 400 com a mensagem do primeiro problema
//   NotFoundError → 404 · ConflictError → 409
//   qualquer outro erro passa para a frente (next(err)): não é este router que decide o 500.
export function createNotesRouter(service) {
  throw new Error('Por fazer: P3');
}
