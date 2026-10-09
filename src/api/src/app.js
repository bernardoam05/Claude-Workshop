import express from 'express';
import { createRequireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/auth.js';
import { createTasksRouter } from './routes/tasks.js';

// Constrói a aplicação Express. Recebe as dependências de fora (injeção de dependências):
// nos testes passamos versões falsas; em produção, as reais (ver index.js).
export function createApp({ service, authService, healthCheck, oidcPublicConfig = null, metrics = null }) {
  const app = express();
  const requireAuth = createRequireAuth(authService.verifyToken);

  // Métricas primeiro: o middleware tem de envolver todos os pedidos, incluindo os que dão erro.
  // /metrics está FORA de /api de propósito: o Nginx só encaminha /api/*, por isso as métricas
  // só são acessíveis dentro da rede Docker (pelo Prometheus), nunca da Internet.
  if (metrics) {
    app.use(metrics.httpMiddleware);
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', metrics.registry.contentType);
      res.send(await metrics.registry.metrics());
    });
  }

  // Middleware por ordem: cada um corre antes do seguinte. Limite de 10kb evita corpos gigantes.
  app.use(express.json({ limit: '10kb' }));

  // Health check: o Docker usa-o para saber se o contentor está saudável. Público.
  app.get('/api/health', async (req, res) => {
    try {
      await healthCheck();
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', reason: err.message });
    }
  });

  app.use('/api', createAuthRouter(authService, oidcPublicConfig));
  app.use('/api', createTasksRouter(service, requireAuth));

  // Os últimos dois middlewares são o "fundo" do pipeline: rotas desconhecidas e erros.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
