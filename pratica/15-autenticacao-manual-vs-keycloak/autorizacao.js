// P4 · Autenticação ("quem és?") e autorização ("o que podes fazer?") como middlewares Express
// (ver docs/15, secção 7 e "Prática").
//
// exigirAutenticacao(verificarToken)
//   middleware: lê "Authorization: Bearer <token>", chama verificarToken(token) (que devolve
//   { userId, papeis } ou lança) e guarda o resultado em req.utilizador.
//   Sem cabeçalho, outro esquema que não Bearer, ou token inválido → 401 {"error": "..."}.
//
// exigirPapel(...papeis)
//   middleware: deixa passar se req.utilizador tiver PELO MENOS UM dos papéis; senão 403.
//   (Assume que o exigirAutenticacao já correu antes.)
//
// podeEditar(utilizador, tarefa) → boolean
//   o dono da tarefa (tarefa.userId === utilizador.userId) ou quem tiver o papel 'admin'.
export function exigirAutenticacao(verificarToken) {
  throw new Error('Por fazer: P4');
}

export function exigirPapel(...papeis) {
  throw new Error('Por fazer: P4');
}

export function podeEditar(utilizador, tarefa) {
  throw new Error('Por fazer: P4');
}
