import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarCachePaginas } from './isr.js';

const tique = () => new Promise((r) => setImmediate(r));
function montar() {
  let t = 0;
  let versao = 0;
  let falhar = false;
  const chamadas = [];
  const cache = criarCachePaginas({
    revalidar: 60,
    agora: () => t,
    gerar: async (caminho) => {
      chamadas.push(caminho);
      await tique();
      if (falhar) throw new Error('a base de dados está em baixo');
      versao++;
      return `${caminho} v${versao}`;
    },
  });
  return { cache, chamadas, avancar: (s) => (t += s * 1000), falhar: (f) => (falhar = f) };
}

describe('P3 · ISR', () => {
  it('MISS, depois HIT dentro do prazo', async () => {
    const { cache, chamadas, avancar } = montar();
    assert.deepEqual(await cache.obter('/'), { html: '/ v1', estado: 'MISS' });
    avancar(59);
    assert.deepEqual(await cache.obter('/'), { html: '/ v1', estado: 'HIT' });
    assert.equal(chamadas.length, 1);
  });
  it('pedidos em paralelo esperam pela mesma geração', async () => {
    const { cache, chamadas } = montar();
    const rs = await Promise.all([cache.obter('/a'), cache.obter('/a'), cache.obter('/a')]);
    assert.equal(chamadas.length, 1);
    assert.ok(rs.every((r) => r.html === '/a v1'));
  });
  it('velha: serve logo a antiga e regenera em segundo plano, uma vez', async () => {
    const { cache, chamadas, avancar } = montar();
    await cache.obter('/');
    avancar(61);
    assert.deepEqual(await cache.obter('/'), { html: '/ v1', estado: 'STALE' });
    assert.deepEqual(await cache.obter('/'), { html: '/ v1', estado: 'STALE' }, 'ainda a regenerar');
    assert.equal(chamadas.length, 2, 'só uma regeneração');
    await tique();
    await tique();
    assert.deepEqual(await cache.obter('/'), { html: '/ v2', estado: 'HIT' });
  });
  it('se a regeneração falhar, fica a antiga e volta a tentar', async () => {
    const { cache, chamadas, avancar, falhar } = montar();
    await cache.obter('/');
    avancar(61);
    falhar(true);
    assert.equal((await cache.obter('/')).html, '/ v1');
    await tique();
    await tique();
    assert.deepEqual(await cache.obter('/'), { html: '/ v1', estado: 'STALE' });
    falhar(false);
    await tique();
    await tique();
    assert.equal((await cache.obter('/')).html, '/ v2');
    assert.equal(chamadas.length, 3);
  });
  it('invalidar obriga a gerar de novo', async () => {
    const { cache } = montar();
    await cache.obter('/tarefas');
    cache.invalidar('/tarefas');
    assert.deepEqual(await cache.obter('/tarefas'), { html: '/tarefas v2', estado: 'MISS' });
  });
  it('um MISS que falha deixa o erro passar e não guarda nada', async () => {
    const { cache, falhar } = montar();
    falhar(true);
    await assert.rejects(cache.obter('/x'), /em baixo/);
    falhar(false);
    assert.equal((await cache.obter('/x')).estado, 'MISS');
  });
});
