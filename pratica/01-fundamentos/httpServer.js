// P2 · Um servidor HTTP sem Express, só com o módulo node:http.
//
// createServer() devolve um http.Server (ainda sem .listen: os testes escolhem a porta).
// Guarda as tarefas num array em memória, DENTRO do createServer (cada servidor tem o seu).
//
//   GET  /health   → 200 {"status":"ok"}
//   GET  /tasks    → 200 [ ...tarefas ]
//   POST /tasks    → corpo {"title":"..."} → 201 {"id":1,"title":"...","done":false}
//                    id começa em 1 e sobe; o título vem sem espaços nas pontas
//                    JSON inválido → 400 {"error":"..."}
//                    title em falta, vazio ou que não é string → 400 {"error":"..."}
//   outro método em /tasks (PUT, DELETE...) → 405 com o cabeçalho Allow: GET, POST
//   qualquer outro caminho → 404 {"error":"..."}
//
// Todas as respostas são JSON, com Content-Type: application/json.
export function createServer() {
  throw new Error('Por fazer: P2');
}
