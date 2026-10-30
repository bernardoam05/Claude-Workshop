import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clienteFalso } from './ajuda.js';
import { FERRAMENTAS, responderComFerramentas } from './agente.js';
import { ferramenta, mensagem, texto } from './servidorFalso.js';

const TAREFAS = { feitas: [{ id: 1, titulo: 'Pagar a luz' }], por_fazer: [{ id: 2, titulo: 'Ler o capítulo 3' }] };
const procurarTarefas = async (estado) => (estado === 'todas' ? [...TAREFAS.feitas, ...TAREFAS.por_fazer] : TAREFAS[estado]);

describe('P3 · definição da ferramenta', () => {
  it('procurar_tarefas, com um esquema estrito', () => {
    assert.equal(FERRAMENTAS.length, 1);
    const [f] = FERRAMENTAS;
    assert.equal(f.name, 'procurar_tarefas');
    assert.match(f.description, /tarefas/);
    assert.equal(f.strict, true);
    assert.deepEqual(f.input_schema, {
      type: 'object',
      properties: { estado: { type: 'string', enum: ['feitas', 'por_fazer', 'todas'] } },
      required: ['estado'],
      additionalProperties: false,
    });
  });
});

describe('P3 · o ciclo do agente', () => {
  it('executa a ferramenta pedida, devolve o resultado, e termina com a resposta', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(
        mensagem({ content: [texto('Vou ver.'), ferramenta('toolu_a', 'procurar_tarefas', { estado: 'por_fazer' })], stop_reason: 'tool_use' }),
        mensagem({ content: [texto('Falta ler o capítulo 3.')] }),
      );
      const r = await responderComFerramentas(cliente, 'O que me falta fazer?', { procurarTarefas });
      assert.deepEqual(r, { resposta: 'Falta ler o capítulo 3.', chamadas: 1 });

      assert.equal(falso.pedidos[0].corpo.tools[0].name, 'procurar_tarefas');
      const msgs = falso.pedidos[1].corpo.messages;
      assert.deepEqual(msgs.map((m) => m.role), ['user', 'assistant', 'user']);
      assert.equal(msgs[1].content.find((b) => b.type === 'tool_use').id, 'toolu_a', 'o assistant leva o content INTEIRO da resposta');
      assert.deepEqual(msgs[2].content, [
        { type: 'tool_result', tool_use_id: 'toolu_a', content: JSON.stringify(TAREFAS.por_fazer) },
      ]);
    } finally {
      falso.fechar();
    }
  });

  it('várias ferramentas na mesma volta: TODOS os resultados numa só mensagem', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(
        mensagem({
          content: [ferramenta('toolu_1', 'procurar_tarefas', { estado: 'feitas' }), ferramenta('toolu_2', 'procurar_tarefas', { estado: 'por_fazer' })],
          stop_reason: 'tool_use',
        }),
        mensagem({ content: [texto('Fizeste 1, faltam 1.')] }),
      );
      const r = await responderComFerramentas(cliente, 'Resumo?', { procurarTarefas });
      assert.equal(r.chamadas, 2);
      const ultima = falso.pedidos[1].corpo.messages.at(-1);
      assert.deepEqual(ultima.content.map((b) => b.tool_use_id), ['toolu_1', 'toolu_2']);
    } finally {
      falso.fechar();
    }
  });

  it('um erro na ferramenta vai para o modelo como is_error, sem rebentar o agente', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(
        mensagem({ content: [ferramenta('toolu_x', 'procurar_tarefas', { estado: 'todas' })], stop_reason: 'tool_use' }),
        mensagem({ content: [texto('Não consegui ler as tarefas.')] }),
      );
      const r = await responderComFerramentas(cliente, 'x', { procurarTarefas: async () => { throw new Error('BD em baixo'); } });
      assert.equal(r.resposta, 'Não consegui ler as tarefas.');
      const resultado = falso.pedidos[1].corpo.messages.at(-1).content[0];
      assert.equal(resultado.is_error, true);
      assert.match(resultado.content, /BD em baixo/);
    } finally {
      falso.fechar();
    }
  });

  it('para ao fim de maxVoltas (um agente sem limite pode gastar sem fim)', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      for (let i = 0; i < 10; i++) {
        falso.responder(mensagem({ content: [ferramenta(`toolu_${i}`, 'procurar_tarefas', { estado: 'todas' })], stop_reason: 'tool_use' }));
      }
      await assert.rejects(responderComFerramentas(cliente, 'x', { procurarTarefas, maxVoltas: 3 }), /voltas/);
      assert.equal(falso.pedidos.length, 3);
    } finally {
      falso.fechar();
    }
  });

  it('um stop_reason inesperado é um erro', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [], stop_reason: 'refusal' }));
      await assert.rejects(responderComFerramentas(cliente, 'x', { procurarTarefas }), /refusal/);
    } finally {
      falso.fechar();
    }
  });
});
