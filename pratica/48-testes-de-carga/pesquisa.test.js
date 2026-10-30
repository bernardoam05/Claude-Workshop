import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arrancarApi, correrK6, temDocker, thresholds } from './ajuda.js';
import { procurar } from './pesquisa.js';

// A versão original (lenta), para comparar os resultados.
function referencia(tarefas, texto) {
  return [...tarefas]
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt'))
    .filter((t) => t.titulo.toLowerCase().includes(texto.toLowerCase()))
    .slice(0, 20);
}

describe('P3 · a pesquisa continua a dar os mesmos resultados', () => {
  const tarefas = Array.from({ length: 3000 }, (_, i) => ({ id: i, titulo: `${['Ação', 'ação', 'Zebra', 'árvore', 'Bola'][i % 5]} ${i}`, feita: false }));
  it('para vários termos, incluindo maiúsculas, acentos e vazio', () => {
    for (const termo of ['ação', 'AÇÃO', 'zebra 1', 'nada', '', '1', '(', 'é']) {
      assert.deepEqual(procurar(tarefas, termo), referencia(tarefas, termo), `termo "${termo}"`);
    }
  });

  it('inclui tarefas acrescentadas depois da primeira pesquisa', () => {
    const lista = tarefas.slice(0, 100);
    procurar(lista, 'x');
    lista.push({ id: 9999, titulo: 'Aaa nova', feita: false });
    assert.equal(procurar(lista, 'nova')[0]?.id, 9999);
    assert.equal(procurar(lista, '')[0]?.id, 9999, 'a ordem tem de a pôr em primeiro');
  });
});

describe('P3 · sob carga', { skip: !temDocker && 'precisa do Docker (o k6 corre num contentor)' }, () => {
  it('10 utilizadores a pesquisar: p(95) abaixo de 100 ms', async () => {
    const api = await arrancarApi();
    try {
      const { codigo, resumo } = await correrK6('procura.js', { BASE_URL: api.baseUrl });
      const p95 = resumo.metrics.http_req_duration.values['p(95)'];
      assert.deepEqual(thresholds(resumo, 'http_req_duration'), { 'p(95)<100': true }, `p(95) = ${p95.toFixed(0)} ms`);
      assert.equal(codigo, 0);
    } finally {
      api.fechar();
    }
  });
});
