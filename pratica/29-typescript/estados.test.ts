import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { descrever, nunca, reduzir, type Acao, type EstadoPedido } from './estados.js';
import { esperar, type Igual } from './testesDeTipos.js';

function tipos(e: EstadoPedido<string[]>, a: Acao<string[]>): void {
  // @ts-expect-error: antes de verificar o tipo, "dados" não existe em todos os estados
  e.dados;
  if (e.tipo === 'sucesso') esperar<Igual<typeof e.dados, string[]>>();
  if (e.tipo === 'erro') esperar<Igual<typeof e.mensagem, string>>();
  // @ts-expect-error: um estado de sucesso sem dados é impossível
  const mau: EstadoPedido<string[]> = { tipo: 'sucesso' };
  // @ts-expect-error: e um estado inventado também
  const inventado: EstadoPedido<string[]> = { tipo: 'pendurado' };
  const seguinte = reduzir(e, a);
  esperar<Igual<typeof seguinte, EstadoPedido<string[]>>>();
  // @ts-expect-error: nunca() só aceita never
  nunca('olá');
  void [mau, inventado];
}
void tipos;

describe('P2 · reduzir', () => {
  it('as transições', () => {
    const inativo: EstadoPedido<number[]> = { tipo: 'inativo' };
    const aCarregar = reduzir(inativo, { tipo: 'pedir' });
    assert.deepEqual(aCarregar, { tipo: 'a_carregar' });
    assert.deepEqual(reduzir(aCarregar, { tipo: 'recebido', dados: [1, 2] }), { tipo: 'sucesso', dados: [1, 2] });
    assert.deepEqual(reduzir(aCarregar, { tipo: 'falhou', mensagem: 'timeout' }), { tipo: 'erro', mensagem: 'timeout' });
    assert.deepEqual(reduzir({ tipo: 'erro', mensagem: 'x' }, { tipo: 'repor' }), { tipo: 'inativo' });
  });
});

describe('P2 · descrever', () => {
  it('um texto por estado', () => {
    assert.equal(descrever({ tipo: 'inativo' }), '');
    assert.equal(descrever({ tipo: 'a_carregar' }), 'A carregar…');
    assert.equal(descrever({ tipo: 'sucesso', dados: [1, 2, 3] }), '3 resultados');
    assert.equal(descrever({ tipo: 'sucesso', dados: ['x'] }), '1 resultado');
    assert.equal(descrever({ tipo: 'erro', mensagem: 'sem rede' }), 'Erro: sem rede');
  });

  it('nunca() lança se for chamado (um estado que o tipo dizia impossível)', () => {
    assert.throws(() => nunca('x' as never));
    assert.throws(() => descrever({ tipo: 'outro' } as never));
  });
});
