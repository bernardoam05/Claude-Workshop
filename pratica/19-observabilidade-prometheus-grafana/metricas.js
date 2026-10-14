// P1 · Instrumentar uma aplicação com o prom-client (o mesmo do src/api/src/observability/metrics.js).
// Ver docs/19-observabilidade-prometheus-grafana.md, secções 3 e 4, e "Prática".
//
// criarMetricas() devolve { registry, tarefaCriada, definirPendentes, medirProcessamento, middleware }:
//   registry            → um client.Registry NOVO (não o global), com a label por omissão service="pratica"
//   tarefaCriada(origem) → incrementa o Counter tarefas_criadas_total{origem="web"|"api"}
//   definirPendentes(n)  → põe o Gauge mensagens_pendentes a n
//   medirProcessamento(fn) → corre `await fn()` e regista quanto demorou (em SEGUNDOS) no Histogram
//                          processamento_duracao_segundos, com os buckets [0.01, 0.05, 0.1, 0.5, 1];
//                          devolve o que fn devolver, e regista a duração MESMO que fn falhe
//   middleware           → middleware Express que conta os pedidos no Counter http_pedidos_total
//                          com as labels method, route e status, em que route é o PADRÃO da rota
//                          (ex.: /tarefas/:id), ou "unmatched" se nenhuma rota correspondeu
// Cada métrica tem um `help` (texto livre) à tua escolha.
export function criarMetricas() {
  throw new Error('Por fazer: P1');
}
