import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { credentialsSchema } from '../validation/taskSchemas.js';

// Rotas públicas: registo, login e configuração de autenticação. Não exigem token.
// oidcPublicConfig: { issuer, clientId } quando o Keycloak está configurado, senão null.
export function createAuthRouter(authService, oidcPublicConfig = null) {
  const router = Router();

  // O frontend pergunta à API como pode autenticar-se, em vez de ter URLs do Keycloak fixos no código.
  // Só dados PÚBLICOS: o issuer e o clientId de um cliente público não são segredos.
  router.get('/auth/config', (req, res) => {
    res.json({ local: true, oidc: oidcPublicConfig });
  });

  router.post('/auth/register', async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const { user, token } = await authService.register(parsed.data.email, parsed.data.password);
    res.status(201).json({ user, token });
  });

  router.post('/auth/login', async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const { user, token } = await authService.login(parsed.data.email, parsed.data.password);
    res.json({ user, token });
  });

  return router;
}
