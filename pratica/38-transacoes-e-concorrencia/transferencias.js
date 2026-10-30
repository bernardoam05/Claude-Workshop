// P2 · Transferências entre contas: atomicidade, e evitar deadlocks.
//
// Tabela: contas (id INT PRIMARY KEY, saldo NUMERIC NOT NULL CHECK (saldo >= 0))
//
// transferir(pool, de, para, valor) → resolve se correu bem; lança um Error com "saldo" se não houver
// saldo suficiente (e nesse caso NADA muda)
//   - numa transação: as duas atualizações acontecem as duas, ou nenhuma
//   - bloqueia as DUAS contas com SELECT ... FOR UPDATE, SEMPRE pela mesma ordem (o id menor primeiro),
//     antes de mexer: sem isto, "A→B" e "B→A" ao mesmo tempo bloqueiam-se um ao outro (deadlock)
//   - valor tem de ser positivo e de != para (senão Error)
export async function transferir(pool, de, para, valor) {
  throw new Error('Por fazer: P2');
}
