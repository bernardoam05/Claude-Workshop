import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErroReutilizacao, criarEmissor } from './renovacao.js';

function montar() {
  let t = 0;
  return { e: criarEmissor({ agora: () => t, vidaAcessoS: 900, vidaRenovacaoS: 86400 }), avancarS: (s) => (t += s * 1000) };
}

describe('P3 · tokens de renovação com rotação', () => {
  it('o token de acesso vale 15 minutos', () => {
    const { e, avancarS } = montar();
    const { acesso, renovacao } = e.emitir('ana');
    assert.match(acesso, /^[\w-]{43}$/);
    assert.notEqual(acesso, renovacao);
    assert.equal(e.validarAcesso(acesso), 'ana');
    avancarS(900);
    assert.equal(e.validarAcesso(acesso), null);
    assert.equal(e.validarAcesso('inventado'), null);
  });
  it('renovar dá um par novo e gasta o antigo', () => {
    const { e, avancarS } = montar();
    const p1 = e.emitir('ana');
    avancarS(1000);
    const p2 = e.renovar(p1.renovacao);
    assert.equal(e.validarAcesso(p2.acesso), 'ana');
    assert.notEqual(p2.renovacao, p1.renovacao);
    const p3 = e.renovar(p2.renovacao);
    assert.equal(e.validarAcesso(p3.acesso), 'ana');
  });
  it('reutilizar um token gasto revoga a família inteira', () => {
    const { e } = montar();
    const p1 = e.emitir('ana');
    const p2 = e.renovar(p1.renovacao); // o utilizador legítimo renova
    assert.throws(() => e.renovar(p1.renovacao), ErroReutilizacao); // o atacante tenta com a cópia
    assert.equal(e.validarAcesso(p2.acesso), null, 'o acesso atual também caiu');
    assert.throws(() => e.renovar(p2.renovacao), /inválido/);
  });
  it('outras famílias (outros dispositivos) não são afetadas', () => {
    const { e } = montar();
    const telemovel = e.emitir('ana');
    const portatil = e.emitir('ana');
    e.renovar(telemovel.renovacao);
    assert.throws(() => e.renovar(telemovel.renovacao), ErroReutilizacao);
    assert.equal(e.validarAcesso(portatil.acesso), 'ana');
    assert.ok(e.renovar(portatil.renovacao));
  });
  it('tokens de renovação expirados ou desconhecidos', () => {
    const { e, avancarS } = montar();
    const p = e.emitir('ana');
    assert.throws(() => e.renovar('inventado'), /inválido/);
    avancarS(86400);
    assert.throws(() => e.renovar(p.renovacao), /inválido/);
  });
  it('logout revoga a família', () => {
    const { e } = montar();
    const p = e.emitir('ana');
    e.revogarFamilia(p.renovacao);
    assert.equal(e.validarAcesso(p.acesso), null);
    assert.throws(() => e.renovar(p.renovacao), /inválido/);
  });
});
