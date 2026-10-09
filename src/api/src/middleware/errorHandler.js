// Erro "esperado" com código HTTP associado (ex.: 404, 400).
// Qualquer outro erro é tratado como 500 (bug ou falha de infraestrutura).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Rota não existe' });
}

// Middleware de erro: tem 4 parâmetros. É isso que o Express usa para o reconhecer.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status ?? 500;
  if (status >= 500) {
    console.error('[erro]', err); // bugs registam-se com stack trace completo
  }
  // Nunca devolvemos detalhes internos (mensagens de SQL, stack traces) a quem chama.
  res.status(status).json({ error: status >= 500 ? 'Erro interno' : err.message });
}
