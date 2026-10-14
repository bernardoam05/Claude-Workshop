import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avaliarAlerta } from './alerta.js';

// Taxa de erros medida de minuto a minuto; o alerta dispara acima de 5% durante 3 minutos (for: 3m).
const serie = (...valores) => valores.map((valor, i) => ({ t: i * 60, valor }));
const regra = { condicao: (v) => v > 0.05, durante: 180 };

describe('P4 · avaliarAlerta', () => {
  it('abaixo do limiar: inactive', () => {
    assert.deepEqual(avaliarAlerta(serie(0.01, 0.02), regra), ['inactive', 'inactive']);
  });

  it('acima do limiar: pending primeiro, firing só ao fim de 3 minutos seguidos', () => {
    assert.deepEqual(avaliarAlerta(serie(0.01, 0.2, 0.2, 0.2, 0.2, 0.2), regra), [
      'inactive',
      'pending', // t=60: começou agora
      'pending', // t=120: há 1 min
      'pending', // t=180: há 2 min
      'firing', // t=240: há 3 min
      'firing',
    ]);
  });

  it('um pico curto não chega a disparar (é para isso que serve o "for")', () => {
    assert.deepEqual(avaliarAlerta(serie(0.3, 0.3, 0.01, 0.3, 0.3), regra), ['pending', 'pending', 'inactive', 'pending', 'pending']);
  });

  it('se a condição falhar, a contagem recomeça do zero', () => {
    const estados = avaliarAlerta(serie(0.2, 0.2, 0.2, 0.01, 0.2, 0.2, 0.2, 0.2), regra);
    assert.deepEqual(estados, ['pending', 'pending', 'pending', 'inactive', 'pending', 'pending', 'pending', 'firing']);
  });

  it('com durante = 0, dispara logo', () => {
    assert.deepEqual(avaliarAlerta(serie(0.2), { ...regra, durante: 0 }), ['firing']);
  });
});
