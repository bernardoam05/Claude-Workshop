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
    <section className="auth">
      <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (mín. 8 caracteres)"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button type="button" className="link" onClick={switchMode}>
        {mode === 'login' ? 'Não tenho conta' : 'Já tenho conta'}
      </button>

      {oidc && (
        <>
          <p className="divider">ou</p>
          <button type="button" className="secondary" onClick={handleKeycloak} disabled={busy}>
            Entrar com Keycloak
          </button>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
