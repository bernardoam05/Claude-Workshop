-- Já feito: as tabelas do P1 e do P2.
CREATE TABLE projects (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE tasks (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects (id),
  title      TEXT    NOT NULL
);

CREATE INDEX tasks_project_id_idx ON tasks (project_id);
