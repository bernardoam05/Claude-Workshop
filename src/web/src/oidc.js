// Login com Keycloak: fluxo "Authorization Code + PKCE", escrito à mão para veres cada passo.
// Em projetos reais usa-se uma biblioteca (keycloak-js, oidc-client-ts), mas ela faz exatamente isto:
//
// 1) O browser é redirecionado para o Keycloak, com um "code_challenge" (hash de um segredo aleatório).
// 2) O utilizador faz login NO KEYCLOAK. A nossa app nunca vê a password.
// 3) O Keycloak redireciona de volta com um "code" de uso único.
// 4) Trocamos o code por um access token, provando que somos quem começou o fluxo (enviamos o segredo original).
//
// Porquê PKCE? Uma SPA não consegue guardar um client secret (o código está no browser de qualquer pessoa).
// O PKCE substitui o secret: mesmo que alguém intercete o "code", sem o verifier não o consegue trocar.

const VERIFIER_KEY = 'oidc-verifier';
const STATE_KEY = 'oidc-state';

// sessionStorage: sobrevive ao redirect para o Keycloak e de volta, mas morre quando o separador fecha.
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* nada */ } },
};

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

async function sha256(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return base64url(new Uint8Array(hash));
}

// O redirect volta sempre para a raiz da app (tem de estar na lista "redirectUris" do cliente no Keycloak).
const redirectUri = () => `${window.location.origin}/`;

// Passo 1: redirecionar para o Keycloak.
export async function startLogin({ issuer, clientId }) {
  const verifier = randomString();
  const state = randomString(); // proteção CSRF: só aceitamos de volta o state que nós gerámos
  store.set(VERIFIER_KEY, verifier);
  store.set(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid email',
    redirect_uri: redirectUri(),
    state,
    code_challenge: await sha256(verifier),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${issuer}/protocol/openid-connect/auth?${params}`);
}

// Passos 3 e 4: se o URL tiver ?code=..., trocá-lo por um token. Devolve o token, ou null se não for um retorno.
export async function handleCallback({ issuer, clientId }) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  // Limpar o URL já: o code é de uso único e não deve ficar no histórico nem ser reenviado num refresh.
  window.history.replaceState({}, '', window.location.pathname);

  const expectedState = store.get(STATE_KEY);
  const verifier = store.get(VERIFIER_KEY);
  store.del(STATE_KEY);
  store.del(VERIFIER_KEY);
  if (!expectedState || params.get('state') !== expectedState || !verifier) {
    throw new Error('Resposta de login inválida (state não corresponde). Tenta outra vez.');
  }

  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error('O Keycloak recusou o código de login');

  const { access_token: accessToken, id_token: idToken } = await res.json();
  return { accessToken, idToken };
}

// Terminar a sessão também no Keycloak. Sem isto, o próximo "Entrar com Keycloak" entra logo sem pedir password,
// porque o Keycloak ainda tem a sessão (cookie) dele.
export function logoutUrl({ issuer, clientId }, idToken) {
  const params = new URLSearchParams({ client_id: clientId, post_logout_redirect_uri: redirectUri() });
  if (idToken) params.set('id_token_hint', idToken);
  return `${issuer}/protocol/openid-connect/logout?${params}`;
}
