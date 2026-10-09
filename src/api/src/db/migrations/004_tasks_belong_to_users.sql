-- Cada tarefa pertence a um utilizador.
-- Nullable de propósito: as tarefas criadas antes de existirem utilizadores ficam "órfãs"
-- e deixam de ser visíveis (todas as queries filtram por user_id). Apagá-las seria uma decisão
-- destrutiva que não cabe a uma migração tomar.
-- ON DELETE CASCADE: apagar um utilizador apaga as suas tarefas.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id);
