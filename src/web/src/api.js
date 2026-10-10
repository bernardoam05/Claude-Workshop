// Cliente HTTP. Os componentes não sabem nada de fetch, URLs ou códigos de erro:
// só chamam funções com nomes de domínio (listTasks, setDone...).
const BASE = '/api';
const TOKEN_KEY = 'workshop-token';
const PROVIDER_KEY = 'workshop-provider'; // 'local' ou 'keycloak': decide como se faz o logout
const ID_TOKEN_KEY = 'workshop-id-token'; // só para o logout no Keycloak (id_token_hint)

// Sessão: o token JWT fica no localStorage. É prático, mas qualquer script na página o consegue ler.
// Uma alternativa mais segura é um cookie httpOnly (ver módulo 13). Lemos/escrevemos sempre dentro de try:
// o localStorage pode não existir (modo privado, cookies bloqueados).
export const session = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getProvider() {
    try {
      return localStorage.getItem(PROVIDER_KEY) ?? 'local';
    } catch {
      return 'local';
    }
  },
  getIdToken() {
    try {
      return localStorage.getItem(ID_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token, provider = 'local', idToken = null) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PROVIDER_KEY, provider);
      if (idToken) localStorage.setItem(ID_TOKEN_KEY, idToken);
    } catch {
      /* sem armazenamento: a sessão dura só enquanto a página estiver aberta */
    }
  },
  clear() {
    try {
      [TOKEN_KEY, PROVIDER_KEY, ID_TOKEN_KEY].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* nada a limpar */
    }
  },
};

async function request(path, options = {}) {
  const token = session.getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    // A API devolve { error: "..." } nos erros. Se o corpo não for JSON, usamos o código HTTP.
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error ?? `Erro HTTP ${res.status}`);
    error.status = res.status; // a App usa isto para detetar sessão expirada (401)
    throw error;
  }

  return res.status === 204 ? null : res.json();
}

export const api = {
  authConfig: () => request('/auth/config'),
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  listTasks: () => request('/tasks'),
  createTask: (title) => request('/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
  setDone: (id, done) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  removeTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  getStats: () => request('/stats'),
};
