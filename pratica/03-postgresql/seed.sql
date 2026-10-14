-- Dados de exemplo para o P2 e o P3. Assumem que o teu schema.sql (P1) já está feito.
-- As datas são relativas a hoje (CURRENT_DATE), para os resultados não mudarem com o tempo.

INSERT INTO users (id, email) VALUES
  (1, 'ana@exemplo.pt'),
  (2, 'bruno@exemplo.pt'),
  (3, 'carla@exemplo.pt');   -- a Carla não tem projetos

INSERT INTO projects (id, owner_id, name) VALUES
  (1, 1, 'Mestrado'),
  (2, 1, 'Casa'),
  (3, 2, 'Ginásio'),
  (4, 2, 'Vazio');           -- projeto sem tarefas

INSERT INTO tasks (project_id, title, done, due_date) VALUES
  (1, 'Ler artigo A',          false, CURRENT_DATE + 2),
  (1, 'Escrever capítulo 1',   false, CURRENT_DATE - 3),
  (1, 'Reunião com orientador', true, CURRENT_DATE - 1),
  (1, 'Rever bibliografia',    false, NULL),
  (1, 'Enviar resumo',         false, CURRENT_DATE + 2),
  (2, 'Pagar a luz',           false, CURRENT_DATE - 1),
  (2, 'Lavar o carro',          true, NULL),
  (3, 'Treino de pernas',       true, CURRENT_DATE - 2),
  (3, 'Treino de costas',       true, CURRENT_DATE - 1),
  (3, 'Treino de braços',       true, CURRENT_DATE - 1),
  (3, 'Marcar avaliação',      false, CURRENT_DATE + 5);

-- Os INSERT acima escolheram os ids à mão: acertamos as sequências para os próximos INSERT
-- (sem isto, o próximo projeto tentava o id 1 e dava chave duplicada).
SELECT setval('users_id_seq', (SELECT max(id) FROM users));
SELECT setval('projects_id_seq', (SELECT max(id) FROM projects));
