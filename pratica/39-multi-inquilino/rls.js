// P3 · Row-Level Security: o próprio Postgres filtra as linhas pelo inquilino, mesmo que o
// código se esqueça do WHERE.
// Tabela (criada pelos testes): notas(inquilino text, id int, texto text)

// ativarRls(db):
//   1. cria o papel `app` (sem login: é o papel com que a aplicação faz as consultas) e dá-lhe
//      SELECT, INSERT, UPDATE e DELETE na tabela notas
//   2. ativa o RLS na tabela, e FORÇA-o (sem o FORCE, o dono da tabela ignora as políticas)
//   3. cria uma política: só as linhas com inquilino = current_setting('app.inquilino', true),
//      tanto para ler (USING) como para escrever (WITH CHECK)
//   (Nota: um superutilizador ignora sempre o RLS; por isso a aplicação usa o papel app.)
export async function ativarRls(db) {
  throw new Error('Por fazer: P3');
}

// comInquilino(db, inquilino, fn) → o resultado de fn(tx)
//   Corre fn numa transação em que: app.inquilino = inquilino (com set_config(..., true), que só
//   vale até ao fim da transação: com um pool de ligações, nunca passa para o pedido seguinte)
//   e o papel é app (SET LOCAL ROLE app).
//   Inquilino que não seja um texto não vazio → lança Error('Inquilino inválido') sem abrir nada.
export async function comInquilino(db, inquilino, fn) {
  throw new Error('Por fazer: P3');
}
