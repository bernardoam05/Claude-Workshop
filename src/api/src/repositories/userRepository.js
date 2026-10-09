// Acesso a dados dos utilizadores. Só SQL aqui; hashing e tokens são responsabilidade do authService.
export function createUserRepository(pool) {
  return {
    async create(email, passwordHash) {
      const { rows } = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash],
      );
      return rows[0];
    },

    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, email, password_hash AS "passwordHash" FROM users WHERE email = $1',
        [email],
      );
      return rows[0] ?? null;
    },

    // "Just-in-time provisioning": a primeira vez que um utilizador do Keycloak chega à API,
    // criamos a linha local que liga o "sub" externo a um id interno (as tarefas usam o id interno).
    // Caminho normal: uma leitura. Só no primeiro pedido há escrita.
    async findOrCreateExternal(externalId, email) {
      const found = await pool.query('SELECT id, email FROM users WHERE external_id = $1', [externalId]);
      if (found.rows[0]) return found.rows[0];

      // ON CONFLICT cobre a corrida de dois primeiros pedidos em simultâneo do mesmo utilizador.
      const { rows } = await pool.query(
        `INSERT INTO users (email, external_id) VALUES ($1, $2)
         ON CONFLICT (external_id) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email`,
        [email, externalId],
      );
      return rows[0];
    },
  };
}
