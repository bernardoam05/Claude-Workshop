// P2 · Escreve aqui os testes do lembretes.js, com dublês de teste (fakes, stubs, mocks).
// Ver docs/11-testes-e-observabilidade.md, secção "Prática".
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { carregar } from './alvo.js';

const { createReminderService } = await carregar('lembretes');

// mock.fn(implementação) cria uma função que se comporta como a implementação E regista as chamadas:
//   const enviar = mock.fn(async () => {});
//   ...
//   enviar.mock.callCount()              → quantas vezes foi chamada
//   enviar.mock.calls[0].arguments       → os argumentos da 1.ª chamada

describe('enviarLembretes', () => {
  // Um exemplo para começar.
  it('sem tarefas para amanhã, não envia nenhum email', async () => {
    const enviar = mock.fn(async () => {});
    const service = createReminderService({
      repository: { tarefasComPrazo: async () => [], marcarLembradas: async () => {} },
      mailer: { enviar },
      clock: () => '2026-10-14',
    });

    assert.deepEqual(await service.enviarLembretes(), { enviados: 0, falhas: [] });
    assert.equal(enviar.mock.callCount(), 0);
  });
});
