// P2 · Uma rampa de carga e um fluxo com escrita e leitura.
//
// - stages: sobe de 0 a 10 vus em 2 s, mantém 10 durante 3 s, desce para 0 em 1 s
// - cada iteração:
//     1. POST ${__ENV.BASE_URL}/api/tarefas com o corpo JSON { "titulo": "Tarefa <vu>-<iteração>" }
//        (as variáveis __VU e __ITER dizem o vu e a iteração) e o cabeçalho Content-Type: application/json
//        check "criada" → status 201
//     2. GET ${__ENV.BASE_URL}/api/tarefas/<id da tarefa criada>, com a tag name: "GET /api/tarefas/:id"
//        (sem isto, cada id seria uma URL diferente nas métricas)
//        check "lida" → status 200
//     3. sleep(0.2)
// - uma métrica própria, uma Trend chamada "tempo_criacao" (com isTime = true), com a duração do POST
//   (r.timings.duration)
// - thresholds: tempo_criacao p(95)<300, http_req_failed rate<0.01, checks rate>0.99
