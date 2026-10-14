import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { processarParticao } from './processadorDeParticao.js';

const mensagens = (...offsets) => offsets.map((offset) => ({ offset, value: `evento ${offset}` }));

// Um handle falso: falha `vezes` vezes seguidas para os offsets indicados, e regista a ordem das chamadas.
function handleQueFalha(falhas = {}) {
  const chamadas = [];
  const restantes = { ...falhas };
  const handle = async (m) => {
    chamadas.push(m.offset);
    if (restantes[m.offset] > 0) {
      restantes[m.offset]--;
      throw new Error(`erro no offset ${m.offset}`);
    }
  };
  return { handle, chamadas };
}

describe('P3 · processarParticao', () => {
  it('tudo bem: processa por ordem e o commit é "último offset + 1"', async () => {
    const { handle, chamadas } = handleQueFalha();
    const r = await processarParticao(mensagens(40, 41, 42), { handle, enviarParaDlt: async () => {} });
    assert.deepEqual(chamadas, [40, 41, 42]);
    assert.deepEqual(r, { offsetParaCommit: 43, processadas: [40, 41, 42], paraDlt: [] });
  });

  it('um erro passageiro: tenta outra vez a MESMA mensagem antes de passar à seguinte', async () => {
    const { handle, chamadas } = handleQueFalha({ 41: 2 });
    const r = await processarParticao(mensagens(40, 41, 42), { handle, enviarParaDlt: async () => {}, maxTentativas: 3 });
    assert.deepEqual(chamadas, [40, 41, 41, 41, 42]);
    assert.deepEqual(r.processadas, [40, 41, 42]);
  });

  it('esgotadas as tentativas: a mensagem vai para o DLT, com o último erro, e a partição continua', async () => {
    const { handle, chamadas } = handleQueFalha({ 41: 99 });
    const dlt = [];
    const r = await processarParticao(mensagens(40, 41, 42), {
      handle,
      enviarParaDlt: async (m, err) => dlt.push([m.offset, err.message]),
      maxTentativas: 2,
    });
    assert.deepEqual(chamadas, [40, 41, 41, 42]);
    assert.deepEqual(dlt, [[41, 'erro no offset 41']]);
    assert.deepEqual(r, { offsetParaCommit: 43, processadas: [40, 42], paraDlt: [41] });
  });

  it('se até o DLT falhar, PARA ali, e o commit não passa dessa mensagem (para ser relida)', async () => {
    const { handle, chamadas } = handleQueFalha({ 41: 99 });
    const r = await processarParticao(mensagens(40, 41, 42), {
      handle,
      enviarParaDlt: async () => {
        throw new Error('o DLT também está em baixo');
      },
      maxTentativas: 1,
    });
    assert.deepEqual(chamadas, [40, 41], 'a 42 não pode ser processada antes da 41 (ordem!)');
    assert.deepEqual(r, { offsetParaCommit: 41, processadas: [40], paraDlt: [] });
  });

  it('se a primeira mensagem nem chegar a ficar tratada, não há nada para commit (null)', async () => {
    const r = await processarParticao(mensagens(7), {
      handle: async () => {
        throw new Error('x');
      },
      enviarParaDlt: async () => {
        throw new Error('y');
      },
      maxTentativas: 1,
    });
    assert.deepEqual(r, { offsetParaCommit: null, processadas: [], paraDlt: [] });
  });

  it('as mensagens são tratadas uma de cada vez (nunca duas em paralelo)', async () => {
    let aDecorrer = 0;
    let maximo = 0;
    const handle = async () => {
      aDecorrer++;
      maximo = Math.max(maximo, aDecorrer);
      await new Promise((resolve) => setTimeout(resolve, 2));
      aDecorrer--;
    };
    await processarParticao(mensagens(1, 2, 3, 4), { handle, enviarParaDlt: async () => {} });
    assert.equal(maximo, 1);
  });
});
