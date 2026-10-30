// A API que vais pôr sob carga (já feita, exceto a pesquisa: essa é o P3, em pesquisa.js).
import http from 'node:http';
import { procurar } from './pesquisa.js';

const PALAVRAS = ['relatório', 'comprar', 'ligar', 'rever', 'enviar', 'pagar', 'estudar', 'marcar', 'ler', 'escrever'];
const COISAS = ['pão', 'fatura', 'capítulo', 'reunião', 'email', 'código', 'contrato', 'consulta', 'artigo', 'orçamento'];

export function criarServidor({ total = 50_000 } = {}) {
  const tarefas = Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    titulo: `${PALAVRAS[(i * 7) % 10]} ${COISAS[(i * 3) % 10]} ${i}`,
    feita: i % 3 === 0,
  }));
  let proximoId = total + 1;
  const pedidos = { total: 0 };

  const json = (res, status, corpo) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(corpo));
  };

  const servidor = http.createServer(async (req, res) => {
    pedidos.total++;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') return json(res, 200, { status: 'ok' });
    if (url.pathname === '/api/tarefas' && req.method === 'GET') return json(res, 200, tarefas.slice(-20));
    if (url.pathname === '/api/tarefas' && req.method === 'POST') {
      let corpo = '';
      for await (const c of req) corpo += c;
      let dados;
      try {
        dados = JSON.parse(corpo);
      } catch {
        return json(res, 400, { error: 'JSON inválido' });
      }
      if (typeof dados.titulo !== 'string' || !dados.titulo.trim()) return json(res, 400, { error: 'titulo obrigatório' });
      const nova = { id: proximoId++, titulo: dados.titulo.trim(), feita: false };
      tarefas.push(nova);
      return json(res, 201, nova);
    }
    const m = url.pathname.match(/^\/api\/tarefas\/(\d+)$/);
    if (m) {
      const t = tarefas.find((x) => x.id === Number(m[1]));
      return t ? json(res, 200, t) : json(res, 404, { error: 'não encontrada' });
    }
    if (url.pathname === '/api/procurar') return json(res, 200, procurar(tarefas, url.searchParams.get('texto') ?? ''));
    json(res, 404, { error: 'não encontrado' });
  });
  return { servidor, pedidos };
}
