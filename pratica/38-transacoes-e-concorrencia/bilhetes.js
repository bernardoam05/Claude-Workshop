// P1 · O último bilhete: uma condição de corrida clássica. Ver docs/38-transacoes-e-concorrencia.md.
//
// Tabelas: eventos (id, nome, disponiveis INT CHECK (disponiveis >= 0)) e compras (id, evento_id, cliente)
//
// A versão ingénua (já escrita, para comparares): lê, decide, escreve. Com pedidos em simultâneo, dois
// leem "1 disponível" ao mesmo tempo, e os dois compram. Corre os testes e vê-a falhar.
export async function comprarIngenuo(pool, eventoId, cliente) {
  const { rows } = await pool.query('SELECT disponiveis FROM eventos WHERE id = $1', [eventoId]);
  if (rows[0].disponiveis < 1) return false;
  await new Promise((r) => setTimeout(r, 5)); // o tempo de "fazer qualquer coisa" entre ler e escrever
  await pool.query('UPDATE eventos SET disponiveis = $1 WHERE id = $2', [rows[0].disponiveis - 1, eventoId]);
  await pool.query('INSERT INTO compras (evento_id, cliente) VALUES ($1, $2)', [eventoId, cliente]);
  return true;
}

// comprarAtomico(pool, eventoId, cliente) → true se comprou, false se esgotou
//   Numa TRANSAÇÃO (BEGIN/COMMIT, num cliente do pool: pool.connect(), e release no finally):
//   - um único UPDATE que só desconta se ainda houver: ... SET disponiveis = disponiveis - 1
//     WHERE id = $1 AND disponiveis > 0 RETURNING disponiveis
//   - se não atualizou nenhuma linha (rowCount 0): ROLLBACK e false
//   - senão, regista a compra e COMMIT
//   - se algo falhar: ROLLBACK e o erro propaga-se
export async function comprarAtomico(pool, eventoId, cliente) {
  throw new Error('Por fazer: P1');
}

// comprarComBloqueio(pool, eventoId, cliente): a mesma coisa, mas com um bloqueio explícito:
//   BEGIN; SELECT disponiveis ... FOR UPDATE (as outras transações que queiram esta linha ESPERAM);
//   decide; UPDATE; INSERT; COMMIT. (Útil quando a decisão é mais complicada do que um WHERE.)
export async function comprarComBloqueio(pool, eventoId, cliente) {
  throw new Error('Por fazer: P1');
}
