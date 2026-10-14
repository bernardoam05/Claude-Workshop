-- Já feito: tabelas de que os teus exercícios dependem. Não precisas de mexer aqui.

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Como a task_events do projeto: event_id é a chave de idempotência (ver P3, addEvent).
CREATE TABLE IF NOT EXISTS task_events (
  event_id     UUID        PRIMARY KEY,
  type         TEXT        NOT NULL,
  task_id      INTEGER     NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
