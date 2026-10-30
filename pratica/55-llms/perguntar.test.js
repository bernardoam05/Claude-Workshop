import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clienteFalso } from './ajuda.js';
import { classificar, resumir } from './perguntar.js';
import { mensagem, texto } from './servidorFalso.js';

describe('P1 · resumir', () => {
  it('envia o modelo, o system, e o texto entre marcas', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('Um resumo.')] }));
      await resumir(cliente, 'O Porto ganhou ao Benfica.');
      const { caminho, corpo } = falso.pedidos[0];
      assert.equal(caminho, '/v1/messages');
      assert.equal(corpo.model, 'claude-opus-5-5');
      assert.equal(corpo.max_tokens, 1024);
      assert.equal(corpo.system, 'Resumes textos em português de Portugal, em no máximo três frases.');
      assert.deepEqual(corpo.messages, [{ role: 'user', content: '<texto>\nO Porto ganhou ao Benfica.\n</texto>' }]);
    } finally {
      falso.fechar();
    }
  });

  it('junta todos os blocos de texto, e diz se foi cortado', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('Primeira parte. '), texto('Segunda.')] }));
      assert.deepEqual(await resumir(cliente, 'x'), { resumo: 'Primeira parte. Segunda.', cortado: false });
      falso.responder(mensagem({ content: [texto('Ficou a me')], stop_reason: 'max_tokens' }));
      assert.deepEqual(await resumir(cliente, 'x'), { resumo: 'Ficou a me', cortado: true });
    } finally {
      falso.fechar();
    }
  });

  it('uma recusa é um erro, e não um resumo vazio', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [], stop_reason: 'refusal' }));
      await assert.rejects(resumir(cliente, 'x'), /recusa/);
    } finally {
      falso.fechar();
    }
  });
});

describe('P1 · classificar (saídas estruturadas)', () => {
  it('pede um JSON com um esquema e devolve-o já validado', async () => {
    const { falso, cliente } = await clienteFalso();
    try {
      falso.responder(mensagem({ content: [texto('{"categoria":"avaria","urgente":true}')] }));
      assert.deepEqual(await classificar(cliente, 'A box não liga desde ontem!'), { categoria: 'avaria', urgente: true });
      const { corpo } = falso.pedidos[0];
      assert.equal(corpo.output_config?.format?.type, 'json_schema', 'falta o output_config.format');
      const esquema = corpo.output_config.format.schema;
      assert.deepEqual(Object.keys(esquema.properties).sort(), ['categoria', 'urgente']);
      assert.match(JSON.stringify(esquema.properties.categoria), /avaria.*faturacao.*duvida/);
      assert.match(corpo.messages[0].content, /<mensagem>[\s\S]*A box não liga desde ontem![\s\S]*<\/mensagem>/);
    } finally {
      falso.fechar();
    }
  });
});
