// Configuração lida de variáveis de ambiente e validada no arranque.
// Regra: se uma variável obrigatória falta, o processo falha logo (fail fast)
// em vez de rebentar mais tarde, a meio de um pedido.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória em falta: ${name}`);
  }
  return value;
}

// Keycloak é opcional: só fica ativo se OIDC_ISSUER estiver definido. Nesse caso, o resto é obrigatório.
function oidcConfig() {
  if (!process.env.OIDC_ISSUER) return null;
  return {
    issuer: process.env.OIDC_ISSUER,           // URL PÚBLICO do realm (o que aparece no "iss" do token)
    jwksUrl: required('OIDC_JWKS_URL'),        // URL INTERNO de onde a API descarrega as chaves públicas
    audience: required('OIDC_AUDIENCE'),       // o "aud" que esta API exige
    clientId: required('OIDC_CLIENT_ID'),      // o cliente público que o frontend usa
  };
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  rabbitUrl: required('RABBITMQ_URL'),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  // O segredo que assina os tokens locais. Quem o conhecer consegue forjar sessões: nunca o commitar.
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  oidc: oidcConfig(),
  // Kafka é opcional: sem KAFKA_BROKERS, os eventos só vão para o RabbitMQ. Formato: "host1:9092,host2:9092".
  kafkaBrokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : null,
};
