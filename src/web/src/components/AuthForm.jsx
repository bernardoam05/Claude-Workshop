import { useState } from 'react';
import { api, session } from '../api.js';
import { startLogin } from '../oidc.js';

// Ecrã de entrada com as DUAS formas de autenticação, lado a lado:
// - formulário próprio (a nossa API guarda o hash da password);
// - Keycloak (a password nunca passa pela nossa app; só recebemos um token).
// oidc: { issuer, clientId } se a API tiver o Keycloak configurado, senão null.
export default function AuthForm({ onAuthenticated, oidc, initialError }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault(); // evita o reload do <form>
    setBusy(true);
    setError(null);
    try {
      const action = mode === 'login' ? api.login : api.register;
      const { token } = await action(email.trim(), password);
      session.setToken(token, 'local');
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleKeycloak() {
    setBusy(true);
    try {
      await startLogin(oidc); // sai da página: o browser vai para o Keycloak
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mt-0 mb-4 text-lg font-semibold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      <form className="mb-3 flex flex-col gap-2" onSubmit={handleSubmit}>
        <input
          className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <input
          className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (mín. 8 caracteres)"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:cursor-wait disabled:opacity-60"
        >
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button type="button" className="px-1 py-0.5 text-accent" onClick={switchMode}>
        {mode === 'login' ? 'Não tenho conta' : 'Já tenho conta'}
      </button>

      {oidc && (
        <>
          <p className="my-3 text-center text-muted">ou</p>
          <button
            type="button"
            className="w-full rounded-lg border border-accent px-4 py-2 text-accent disabled:cursor-wait disabled:opacity-60"
            onClick={handleKeycloak}
            disabled={busy}
          >
            Entrar com Keycloak
          </button>
        </>
      )}
      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-danger" role="alert">{error}</p>}
    </section>
  );
}
