import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularChallenge, gerarPkce, gerarVerifier } from './pkce.js';

describe('P3 · PKCE', () => {
  it('o challenge do exemplo oficial do RFC 7636 (apêndice B)', () => {
    // Este par vem do próprio RFC: se o teu cálculo der isto, dá o mesmo que o Keycloak.
    assert.equal(calcularChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('o verifier tem 43 caracteres do alfabeto permitido, e é diferente em cada chamada', () => {
    const v1 = gerarVerifier();
    assert.match(v1, /^[A-Za-z0-9\-._~]{43}$/);
    assert.notEqual(gerarVerifier(), v1);
  });

  it('gerarPkce junta tudo, com o method S256', () => {
    const { verifier, challenge, method } = gerarPkce();
    assert.equal(method, 'S256');
    assert.equal(challenge, calcularChallenge(verifier));
  });
});
