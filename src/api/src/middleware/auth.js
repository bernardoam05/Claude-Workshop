import { HttpError } from './errorHandler.js';

// Middleware de autenticação. Espera o cabeçalho "Authorization: Bearer <token>".
// Recebe a função de verificação por parâmetro: não sabe se o token é local ou do Keycloak,
// só conhece o contrato verifyToken(token) → { userId }.
export function createRequireAuth(verifyToken) {
  return async function requireAuth(req, res, next) {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new HttpError(401, 'Autenticação necessária'));
    }

    try {
      req.user = await verifyToken(token); // disponível nas rotas seguintes como req.user.userId
      next();
    } catch (err) {
      // Erros com status (ex.: 409 de conta duplicada) passam como estão; tudo o resto é token inválido.
      next(err.status ? err : new HttpError(401, 'Token inválido ou expirado'));
    }
  };
}
