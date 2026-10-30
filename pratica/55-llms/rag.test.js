import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bdComVetores, clienteFalso, embedFalso } from './ajuda.js';
import { indexar, partir, procurar, responder } from './rag.js';
import { mensagem, texto } from './servidorFalso.js';

const DOCUMENTOS = [
  { nome: 'ferias.md', texto: 'Cada pessoa tem 25 dias de férias por ano. As férias marcam-se até março.' },
  { nome: 'salarios.md', texto: 'O salário é pago no dia 25. O pagamento é feito por transferência.' },
  { nome: 'teletrabalho.md', texto: 'O teletrabalho é permitido dois dias por semana, a partir de casa, com o computador da empresa.' },
  { nome: 'despesas.md', texto: 'O reembolso de despesas com o computador é pedido no portal, com a fatura.' },
];

describe('P4 · partir', () => {
  it('pedaços com sobreposição', () => {
    assert.deepEqual(partir('a b c d e f g', 3, 1), ['a b c', 'c d e', 'e f g']);
    assert.deepEqual(partir('a b c d e f', 3, 1), ['a b c', 'c d e', 'e f']);
    assert.deepEqual(partir('a b', 5, 2), ['a b']);
    assert.deepEqual(partir('a  b\n c', 2, 0), ['a b', 'c']);
    assert.deepEqual(partir('', 3, 1), []);
  });

  it('sobreposição tem de ser menor do que o tamanho', () => {
    assert.deepEqual(partir('a b c', 2, 1), ['a b', 'b c']);
    assert.throws(() => partir('a b c', 2, 2));
  });
});

describe('P4 · indexar e procurar (pgvector)', () => {
  it('guarda um pedaço por bocado de texto, com o embedding', async () => {
    const db = await bdComVetores();
    const n = await indexar(db, DOCUMENTOS, embedFalso);
    assert.equal(n, 4);
    const { rows } = await db.query(`SELECT documento, embedding::text AS e FROM pedacos ORDER BY id`);
    assert.deepEqual(rows.map((r) => r.documento), ['ferias.md', 'salarios.md', 'teletrabalho.md', 'despesas.md']);
    assert.match(rows[0].e, /^\[2\.01,1\.01,/, 'o embedding do primeiro pedaço não bate certo');
  });

  it('parte os documentos grandes', async () => {
    const db = await bdComVetores();
    const n = await indexar(db, [{ nome: 'grande.md', texto: Array.from({ length: 25 }, (_, i) => `p${i}`).join(' ') }], embedFalso, { tamanho: 10, sobreposicao: 2 });
    assert.equal(n, 3);
  });

  it('encontra os pedaços mais próximos da pergunta, por ordem', async () => {
    const db = await bdComVetores();
    await indexar(db, DOCUMENTOS, embedFalso);
    const r = await procurar(db, 'Quantos dias de férias tenho?', embedFalso, 2);
    assert.equal(r.length, 2);
    assert.equal(r[0].documento, 'ferias.md');
    assert.ok(r[0].distancia < r[1].distancia, 'devia vir do mais próximo para o mais longe');
    assert.deepEqual(Object.keys(r[0]).sort(), ['distancia', 'documento', 'id', 'texto']);
    const r2 = await procurar(db, 'Como peço o reembolso?', embedFalso, 1);
    assert.equal(r2[0].documento, 'despesas.md');
  });

  it('o embedding vai como parâmetro, nunca colado no SQL', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./rag.js', import.meta.url), 'utf8');
    assert.ok(!/\$\{\s*JSON\.stringify/.test(codigo), 'usa $1, $2... e um array de parâmetros');
    const db = await bdComVetores();
    assert.equal(await indexar(db, DOCUMENTOS.slice(0, 1), embedFalso), 1);
  });
});

describe('P4 · responder', () => {
  it('dá ao modelo os documentos encontrados, entre marcas, e devolve as fontes', async () => {
    const db = await bdComVetores();
    await indexar(db, DOCUMENTOS, embedFalso);
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('Tens 25 dias de férias.')] }));
      const r = await responder(cliente, db, 'Quantos dias de férias tenho?', embedFalso);
      assert.equal(r.resposta, 'Tens 25 dias de férias.');
      assert.equal(r.fontes[0], 'ferias.md');
      assert.equal(new Set(r.fontes).size, r.fontes.length, 'as fontes não se repetem');

      const { corpo } = falso.pedidos[0];
      assert.match(corpo.system, /só com base nos documentos/);
      const conteudo = corpo.messages[0].content;
      assert.match(conteudo, /<documentos>[\s\S]*<documento nome="ferias\.md">Cada pessoa tem 25 dias[\s\S]*<\/documentos>/);
      assert.match(conteudo, /<pergunta>Quantos dias de férias tenho\?<\/pergunta>/);
      assert.equal((conteudo.match(/<documento nome=/g) ?? []).length, 3);
    } finally {
      falso.fechar();
    }
  });
});
