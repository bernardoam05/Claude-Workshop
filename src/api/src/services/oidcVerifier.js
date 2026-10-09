import { createRemoteJWKSet, jwtVerify } from 'jose';

// Verificador de tokens emitidos por um Identity Provider OIDC (aqui, o Keycloak).
//
// Diferença essencial para o JWT local:
// - local: HS256, um SEGREDO partilhado assina e verifica (quem verifica também consegue emitir);
// - OIDC:  RS256, o Keycloak assina com a chave PRIVADA e publica as chaves PÚBLICAS num endpoint (JWKS).
//          A API só consegue verificar, nunca emitir. É por isso que vários serviços podem confiar no mesmo IdP.
export function createOidcVerifier({ issuer, jwksUrl, audience }) {
  // Descarrega as chaves públicas na primeira utilização e guarda-as em cache.
  // Se o Keycloak rodar as chaves (novo "kid"), a biblioteca volta a descarregar sozinha.
  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  return async function verify(token) {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,               // "iss": o token tem de vir DESTE Keycloak e deste realm
      audience,             // "aud": o token tem de ter sido emitido PARA esta API (não para outra aplicação)
      algorithms: ['RS256'], // nunca aceitar o algoritmo que o próprio token declara sem o restringir
    });
    return payload; // claims: sub, email, preferred_username, realm_access.roles, exp...
  };
}
