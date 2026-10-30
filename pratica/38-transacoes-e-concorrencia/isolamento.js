// P4 · Níveis de isolamento e erros de serialização.

// contarDuasVezes(pool, nivel, entreAsDuas) → [primeira, segunda]
//   Numa transação com o nível dado ("READ COMMITTED" ou "REPEATABLE READ"):
//     BEGIN ISOLATION LEVEL <nivel>; conta as tarefas; chama await entreAsDuas() (os testes usam-na
//     para inserir uma tarefa NOUTRA ligação); conta outra vez; COMMIT.
//   Só aceita esses dois níveis (o nível não pode ser um parâmetro $1: valida-o contra uma lista).
export async function contarDuasVezes(pool, nivel, entreAsDuas) {
  throw new Error('Por fazer: P4');
}

// emSerializavel(pool, fn, { tentativas = 5 }) → o resultado de fn(cliente)
//   Corre fn(cliente) numa transação SERIALIZABLE. Se o Postgres a cancelar com um erro de
//   serialização (err.code === "40001"), faz ROLLBACK e REPETE a transação inteira, até `tentativas`.
//   Outros erros: ROLLBACK e propagam-se logo. Liberta sempre o cliente.
export async function emSerializavel(pool, fn, { tentativas = 5 } = {}) {
  throw new Error('Por fazer: P4');
}

// sairDoTurno(pool, medico) → true se saiu, false se não podia
//   A regra de negócio: tem de ficar SEMPRE pelo menos um médico de turno.
//   Dentro de emSerializavel: conta os médicos de turno; se forem 2 ou mais, tira este do turno
//   (UPDATE medicos SET de_turno = false WHERE nome = $1) e devolve true; senão, false.
//   Sem SERIALIZABLE, dois médicos a sair ao mesmo tempo veem os dois "2 de turno", e saem os dois
//   (o "write skew"): os testes provam-no.
export async function sairDoTurno(pool, medico) {
  throw new Error('Por fazer: P4');
}
