-- Utilizadores da aplicação.
-- A password NUNCA é guardada em texto simples: só o hash bcrypt (password_hash).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,   -- UNIQUE cria um índice e impede duplicados ao nível da BD
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
