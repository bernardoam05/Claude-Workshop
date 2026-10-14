// P3 · PKCE (Proof Key for Code Exchange, RFC 7636), o que o src/web/src/oidc.js faz no browser
// antes de mandar o utilizador para o Keycloak (ver docs/15, secções 3 e "Prática").
//
// gerarVerifier() → string aleatória de 43 caracteres, só com [A-Za-z0-9-._~]
//                   (32 bytes aleatórios em base64url dão exatamente isso)
// calcularChallenge(verifier) → base64url(SHA-256(verifier))
// gerarPkce() → { verifier, challenge, method: 'S256' }
export function gerarVerifier() {
  throw new Error('Por fazer: P3');
}

export function calcularChallenge(verifier) {
  throw new Error('Por fazer: P3');
}

export function gerarPkce() {
  throw new Error('Por fazer: P3');
}
