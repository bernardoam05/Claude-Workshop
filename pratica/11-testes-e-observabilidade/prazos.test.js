// P1 · Escreve aqui os testes do prazos.js. Ver docs/11-testes-e-observabilidade.md, secção "Prática".
// Importa SEMPRE através do carregar() (ver alvo.js) e nunca diretamente de './prazos.js':
// é isso que permite ao verificador correr os teus testes contra os mutantes.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carregar } from './alvo.js';

const { estadoDaTarefa, ordenarPorUrgencia } = await carregar('prazos');

describe('estadoDaTarefa', () => {
  // Um exemplo para começar. Mantém-no e escreve os outros à volta dele.
  it('uma tarefa feita está concluída', () => {
    assert.equal(estadoDaTarefa({ done: true, due: '2026-10-20' }, '2026-10-14'), 'concluida');
  });
});

describe('ordenarPorUrgencia', () => {
  // Os teus testes aqui. (O `void` só existe para o linter não se queixar enquanto não os escreves.)
  void ordenarPorUrgencia;
});
