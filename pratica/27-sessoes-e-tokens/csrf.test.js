import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { origemPermitida, tokenCsrf, validarCsrf } from './csrf.js';

const permitidas = ['https://tarefas.exemplo.pt'];
const post = (cabecalhos) => ({ metodo: 'POST', cabecalhos });

describe('P4 · origemPermitida', () => {
  it('métodos seguros passam sempre', () => {
    assert.equal(origemPermitida({ metodo: 'GET', cabecalhos: { 'sec-fetch-site': 'cross-site' } }, permitidas), true);
  });
  it('Sec-Fetch-Site decide quando existe', () => {
    assert.equal(origemPermitida(post({ 'sec-fetch-site': 'same-origin' }), permitidas), true);
    assert.equal(origemPermitida(post({ 'sec-fetch-site': 'cross-site', origin: 'https://tarefas.exemplo.pt' }), permitidas), false);
    assert.equal(origemPermitida(post({ 'sec-fetch-site': 'same-site' }), permitidas), false);
  });
  it('senão, a Origin', () => {
    assert.equal(origemPermitida(post({ origin: 'https://tarefas.exemplo.pt' }), permitidas), true);
    assert.equal(origemPermitida(post({ origin: 'https://atacante.exemplo' }), permitidas), false);
    assert.equal(origemPermitida(post({ 'sec-fetch-site': 'none', origin: 'https://tarefas.exemplo.pt' }), permitidas), true);
  });
  it('senão, o Referer', () => {
    assert.equal(origemPermitida(post({ referer: 'https://tarefas.exemplo.pt/projetos/1?x=2' }), permitidas), true);
    assert.equal(origemPermitida(post({ referer: 'https://tarefas.exemplo.pt.atacante.exemplo/' }), permitidas), false);
    assert.equal(origemPermitida(post({ referer: 'lixo' }), permitidas), false);
  });
  it('sem nada, recusa', () => {
    assert.equal(origemPermitida(post({}), permitidas), false);
  });
});

describe('P4 · token CSRF', () => {
  const segredo = 'segredo-de-teste';
  it('é um HMAC do id da sessão', () => {
    assert.equal(tokenCsrf('s1', segredo), createHmac('sha256', segredo).update('s1').digest('base64url'));
  });
  it('valida o token certo e recusa os outros', () => {
    const t = tokenCsrf('s1', segredo);
    assert.equal(validarCsrf(post({ 'x-csrf-token': t }), 's1', segredo), true);
    assert.equal(validarCsrf(post({ 'x-csrf-token': t }), 's2', segredo), false, 'o token de outra sessão');
    assert.equal(validarCsrf(post({ 'x-csrf-token': 'curto' }), 's1', segredo), false);
    assert.equal(validarCsrf(post({}), 's1', segredo), false);
    assert.equal(validarCsrf(post({ 'x-csrf-token': t }), undefined, segredo), false);
  });
  it('métodos seguros não precisam de token', () => {
    assert.equal(validarCsrf({ metodo: 'GET', cabecalhos: {} }, 's1', segredo), true);
  });
});
