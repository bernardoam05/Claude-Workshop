-- Já feito: as tabelas do P3.
CREATE TABLE tasks (
  id    SERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)
);

-- A "caixa de saída": eventos que AINDA têm de ser publicados no RabbitMQ.
-- Escritos na mesma transação que a tarefa; publicados depois, por um processo à parte (o relay).
CREATE TABLE outbox (
  id           SERIAL      PRIMARY KEY,
  routing_key  TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ             -- NULL = ainda por publicar
);
