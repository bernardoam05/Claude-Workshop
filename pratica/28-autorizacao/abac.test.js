import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avaliar } from './abac.js';

const politicas = [
  { id: 'dono-edita', efeito: 'permitir', acoes: ['ler', 'editar', 'apagar'], condicao: ({ sujeito, recurso }) => recurso.dono === sujeito.id },
  { id: 'equipa-le', efeito: 'permitir', acoes: ['ler'], condicao: ({ sujeito, recurso }) => sujeito.equipa === recurso.equipa },
  { id: 'arquivadas-so-leitura', efeito: 'negar', acoes: ['editar', 'apagar'], condicao: ({ recurso }) => recurso.arquivada },
  { id: 'fora-de-horas', efeito: 'negar', acoes: ['apagar'], condicao: ({ contexto }) => contexto.hora < 8 || contexto.hora >= 20 },
  { id: 'suporte-le-tudo', efeito: 'permitir', acoes: ['ler'], condicao: ({ sujeito }) => sujeito.departamento === 'suporte' },
];
const ana = { id: 'ana', equipa: 'api' };
const tarefa = { dono: 'ana', equipa: 'api', arquivada: false };
const pedido = (sujeito, acao, recurso = tarefa, contexto = { hora: 10 }) => ({ sujeito, acao, recurso, contexto });

describe('P2 · ABAC', () => {
  it('permitir pelo atributo certo', () => {
    assert.deepEqual(avaliar(politicas, pedido(ana, 'editar')), { permitido: true, motivo: 'dono-edita' });
    assert.deepEqual(avaliar(politicas, pedido({ id: 'rui', equipa: 'api' }, 'ler')), { permitido: true, motivo: 'equipa-le' });
  });
  it('negado por omissão', () => {
    assert.deepEqual(avaliar(politicas, pedido({ id: 'rui', equipa: 'web' }, 'ler')), { permitido: false, motivo: 'nenhuma política' });
    assert.deepEqual(avaliar(politicas, pedido({ id: 'rui', equipa: 'api' }, 'editar')), { permitido: false, motivo: 'nenhuma política' });
  });
  it('negar ganha a permitir', () => {
    assert.deepEqual(avaliar(politicas, pedido(ana, 'editar', { ...tarefa, arquivada: true })), { permitido: false, motivo: 'arquivadas-so-leitura' });
    assert.deepEqual(avaliar(politicas, pedido(ana, 'apagar', tarefa, { hora: 22 })), { permitido: false, motivo: 'fora-de-horas' });
    assert.equal(avaliar(politicas, pedido(ana, 'ler', { ...tarefa, arquivada: true })).permitido, true, 'ler não é afetado');
  });
  it("'*' nas ações e políticas sem condição", () => {
    const p = [{ id: 'manutencao', efeito: 'negar', acoes: ['*'] }, { id: 'todos', efeito: 'permitir', acoes: ['ler'] }];
    assert.deepEqual(avaliar(p, pedido(ana, 'ler')), { permitido: false, motivo: 'manutencao' });
    assert.deepEqual(avaliar(p.slice(1), pedido(ana, 'ler')), { permitido: true, motivo: 'todos' });
  });
  it('uma condição que rebenta falha fechada', () => {
    const p = [{ id: 'partida', efeito: 'permitir', acoes: ['ler'], condicao: ({ recurso }) => recurso.projeto.publico }];
    assert.deepEqual(avaliar(p, pedido(ana, 'ler')), { permitido: false, motivo: 'erro em partida' });
  });
  it('só true conta como true', () => {
    const p = [{ id: 'quase', efeito: 'permitir', acoes: ['ler'], condicao: () => 'sim' }];
    assert.equal(avaliar(p, pedido(ana, 'ler')).permitido, false);
  });
});
