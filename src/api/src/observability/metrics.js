import client from 'prom-client';

// Métricas no formato Prometheus. O Prometheus vem buscar (PULL) a GET /metrics a cada 15 s.
// Cada métrica tem um nome, um tipo e labels. Tipos usados aqui:
// - Counter:   só sobe (pedidos, erros). No Grafana usa-se rate() para ver "por segundo".
// - Histogram: distribui valores em intervalos (buckets). Permite calcular percentis (p95, p99) da latência.
export function createMetrics() {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: 'api' });

  // CPU, memória, event loop lag, garbage collector... de graça.
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração dos pedidos HTTP',
    // CUIDADO com a cardinalidade: "route" é o padrão (/api/tasks/:id), nunca o caminho real (/api/tasks/42).
    // Com o caminho real, cada id criaria uma série nova e o Prometheus enchia a memória.
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  const eventsPublished = new client.Counter({
    name: 'events_published_total',
    help: 'Eventos publicados, por broker, tipo e resultado',
    labelNames: ['broker', 'type', 'result'],
    registers: [registry],
  });

  // Middleware Express: mede cada pedido do início até a resposta ser enviada.
  function httpMiddleware(req, res, next) {
    const stop = httpDuration.startTimer();
    res.on('finish', () => {
      // req.route só existe se uma rota correspondeu. Sem rota → "unmatched" (evita labels infinitas com 404s).
      const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      stop({ method: req.method, route, status: String(res.statusCode) });
    });
    next();
  }

  return {
    registry,
    httpMiddleware,
    recordKafka: (type, result) => eventsPublished.inc({ broker: 'kafka', type, result }),
  };
}
