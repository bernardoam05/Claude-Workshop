-- Tabela principal do domínio: tarefas.
-- SERIAL (int4) é lido pelo driver pg como número JS. BIGSERIAL (int8) viria como string.

CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks (created_at DESC);
