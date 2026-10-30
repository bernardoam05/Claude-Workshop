// Dados partilhados pelos testes (não é um exercício).
import { PGlite } from '@electric-sql/pglite';

export async function baseDeDados() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE tarefas (
      id int PRIMARY KEY, titulo text NOT NULL, utilizador text NOT NULL, projeto text NOT NULL,
      criada_em date NOT NULL, concluida_em date, pontos int NOT NULL, pai_id int REFERENCES tarefas
    );
    INSERT INTO tarefas VALUES
      (1, 'Lançar a v2',        'ana', 'api', '2026-10-01', NULL,         13, NULL),
      (2, 'Desenhar o esquema', 'ana', 'api', '2026-10-01', '2026-10-03',  5, 1),
      (3, 'Migrações',          'rui', 'api', '2026-10-02', '2026-10-06',  8, 2),
      (4, 'Índices',            'rui', 'api', '2026-10-02', '2026-10-04',  3, 2),
      (5, 'Endpoints',          'eva', 'api', '2026-10-05', NULL,          8, 1),
      (6, 'Testes',             'eva', 'api', '2026-10-05', '2026-10-12',  5, 5),
      (7, 'Página inicial',     'ana', 'web', '2026-10-03', '2026-10-05',  5, NULL),
      (8, 'Formulário',         'rui', 'web', '2026-10-03', '2026-10-10',  8, 7),
      (9, 'Acessibilidade',     'eva', 'web', '2026-10-06', NULL,          3, 7),
      (10,'Dashboards',         'ana', 'ops', '2026-10-06', '2026-10-07',  2, NULL);
  `);
  return db;
}
