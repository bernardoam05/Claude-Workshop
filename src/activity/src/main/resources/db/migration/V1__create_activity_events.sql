-- Flyway: o nome segue a convenção V<versão>__<descrição>.sql. Aplica por ordem e regista em flyway_schema_history.
-- Mesma regra do nosso migrate.js: nunca editar uma migração já aplicada; criar V2, V3...

CREATE TABLE activity_events (
  event_id        UUID        PRIMARY KEY,                -- chave de idempotência
  type            TEXT        NOT NULL,
  task_id         BIGINT      NOT NULL,
  user_id         BIGINT      NOT NULL,
  title           TEXT,
  occurred_at     TIMESTAMPTZ,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  kafka_partition INTEGER     NOT NULL,                   -- de que partição veio (para estudar o particionamento)
  kafka_offset    BIGINT      NOT NULL
);

CREATE INDEX activity_events_received_at_idx ON activity_events (received_at DESC);
