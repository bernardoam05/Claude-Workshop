// P1 · O teu primeiro teste de carga com o k6 (este ficheiro corre DENTRO do k6, não no Node).
//
// - 5 utilizadores virtuais (vus) durante 3 segundos
// - cada iteração: GET ${__ENV.BASE_URL}/api/tarefas, com dois checks:
//     "status 200"   → r.status === 200
//     "é uma lista"  → Array.isArray(r.json())
//   e depois uma pausa de 0,1 s (sleep), como um utilizador real que não clica sem parar
// - thresholds (o teste FALHA se não forem cumpridos):
//     http_req_failed:   menos de 1% de pedidos falhados   → "rate<0.01"
//     http_req_duration: p(95) abaixo de 300 ms            → "p(95)<300"
//     checks:            mais de 99% dos checks a passar   → "rate>0.99"
