-- Utilizadores que vêm de um Identity Provider externo (Keycloak).
-- external_id guarda o "sub" do token (o id do utilizador no Keycloak). UNIQUE: um utilizador externo = uma linha.
-- password_hash passa a ser opcional: quem entra pelo Keycloak não tem password nesta BD (quem a guarda é o Keycloak).

ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
