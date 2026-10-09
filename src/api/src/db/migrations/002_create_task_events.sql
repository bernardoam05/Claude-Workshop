-- Registo de eventos processados pelo worker.
-- event_id é a CHAVE DE IDEMPOTÊNCIA: a mesma mensagem nunca entra duas vezes.
-- task_id não tem FOREIGN KEY de propósito: o evento pode ser processado depois de a tarefa ter sido apagada.

CREATE TABLE IF NOT EXISTS task_events (
  event_id     UUID        PRIMARY KEY,
  type         TEXT        NOT NULL,
  task_id      INTEGER     NOT NULL,
  payload      JSONB       NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_events_type_idx ON task_events (type);
