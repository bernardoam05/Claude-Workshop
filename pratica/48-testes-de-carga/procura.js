// O teste de carga do P3 (já feito: não precisas de mexer). 10 utilizadores a pesquisar durante 4 s.
// Com a pesquisa lenta, o p(95) passa largamente dos 100 ms; com a pesquisa otimizada, fica muito abaixo.
import http from 'k6/http';
import { check } from 'k6';

const TERMOS = ['fatura', 'Relatório', 'pão 1', 'contrato 49', 'xyz-nada', 'ler', ''];

export const options = {
  vus: 10,
  duration: '4s',
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const termo = TERMOS[(__VU + __ITER) % TERMOS.length];
  const r = http.get(`${__ENV.BASE_URL}/api/procurar?texto=${encodeURIComponent(termo)}`, { tags: { name: 'GET /api/procurar' } });
  check(r, { 'status 200': (x) => x.status === 200 });
}
