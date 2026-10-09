import Redis from 'ioredis';
import { createApp } from './app.js';
import { createCache } from './cache/cache.js';
import { config } from './config.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createCompositePublisher } from './messaging/compositePublisher.js';
import { createKafkaPublisher } from './messaging/kafkaPublisher.js';
import { createPublisher } from './messaging/publisher.js';
import { createMetrics } from './observability/metrics.js';
import { createAuthService } from './services/authService.js';
import { createOidcVerifier } from './services/oidcVerifier.js';
import { createTaskRepository } from './repositories/taskRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createTaskService } from './services/taskService.js';

// Ponto de composição: é aqui que se ligam as peças concretas (Postgres, Redis, RabbitMQ).
// Todo o resto recebe estas dependências por parâmetro.
async function main() {
  const pool = createPool(config.databaseUrl);
  await migrate(pool);

  const redis = new Redis(config.redisUrl);
  const metrics = createMetrics();

  // RabbitMQ obrigatório + Kafka opcional (best-effort). Ver messaging/compositePublisher.js.
  const kafka = config.kafkaBrokers ? await createKafkaPublisher({ brokers: config.kafkaBrokers }) : null;
  console.log(`[api] eventos: RabbitMQ${kafka ? ` + Kafka (${config.kafkaBrokers.join(',')})` : ''}`);
  const publisher = createCompositePublisher({
    rabbit: await createPublisher(config.rabbitUrl),
    kafka,
    onKafkaResult: metrics.recordKafka,
  });

  const service = createTaskService({
    repository: createTaskRepository(pool),
    cache: createCache(redis),
    publisher,
    cacheTtlSeconds: config.cacheTtlSeconds,
  });

  const authService = createAuthService({
    userRepository: createUserRepository(pool),
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
    oidcVerify: config.oidc ? createOidcVerifier(config.oidc) : null,
  });
  console.log(`[api] autenticação: local${config.oidc ? ` + Keycloak (${config.oidc.issuer})` : ''}`);

  const app = createApp({
    service,
    authService,
    metrics,
    oidcPublicConfig: config.oidc ? { issuer: config.oidc.issuer, clientId: config.oidc.clientId } : null,
    healthCheck: async () => {
      await pool.query('SELECT 1');
      await redis.ping();
    },
  });

  const server = app.listen(config.port, () => {
    console.log(`[api] a ouvir na porta ${config.port}`);
  });

  // Encerramento gracioso: "docker stop" envia SIGTERM. Terminamos os pedidos em curso
  // e fechamos as ligações, em vez de matar o processo a meio de uma escrita.
  const shutdown = (signal) => {
    console.log(`[api] ${signal} recebido, a encerrar`);
    server.close(async () => {
      await publisher.close().catch(() => {});
      await pool.end();
      redis.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] falha no arranque:', err);
  process.exit(1); // exit code != 0 → o Docker (restart policy) volta a tentar
});
