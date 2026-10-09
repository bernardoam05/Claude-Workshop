import { useCallback, useEffect, useState } from 'react';
import { api, session } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import { handleCallback, logoutUrl } from './oidc.js';
import StatsBar from './components/StatsBar.jsx';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';

// Estatísticas são pedidas periodicamente porque o worker processa eventos em background:
// o número "processadas pelo worker" atualiza-se com alguns segundos de atraso (consistência eventual).
const STATS_POLL_MS = 3000;

export default function App() {
  // Sem token guardado, mostramos o ecrã de login. A decisão nasce do estado, não de um redirect.
  const [authenticated, setAuthenticated] = useState(() => session.getToken() !== null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [authConfig, setAuthConfig] = useState(null); // { oidc: { issuer, clientId } | null }
  const [loginError, setLoginError] = useState(null);

  // Ao abrir a app: perguntar à API que formas de login existem e, se estivermos a voltar
  // do Keycloak (?code=... no URL), trocar o code por um token.
  useEffect(() => {
    api
      .authConfig()
      .then(async (cfg) => {
        setAuthConfig(cfg);
        if (!cfg.oidc) return;
        const result = await handleCallback(cfg.oidc);
        if (result) {
          session.setToken(result.accessToken, 'keycloak', result.idToken);
          setAuthenticated(true);
        }
      })
      .catch((err) => setLoginError(err.message));
  }, []);

  const logout = useCallback(() => {
    const provider = session.getProvider();
    const idToken = session.getIdToken();
    session.clear();
    setTasks([]);
    setStats(null);
    setError(null);
    setAuthenticated(false);
    // Sessão do Keycloak: tem de ser terminada LÁ, senão o próximo login entra sem pedir password.
    if (provider === 'keycloak' && authConfig?.oidc) {
      window.location.assign(logoutUrl(authConfig.oidc, idToken));
    }
  }, [authConfig]);

  const loadTasks = useCallback(async () => {
    setTasks(await api.listTasks());
  }, []);

  // Executa uma ação, recarrega a lista e centraliza o tratamento de erros.
  // Um 401 significa que o token expirou ou é inválido: terminamos a sessão em vez de mostrar um erro genérico.
  const run = useCallback(
    async (action) => {
      try {
        await action();
        await loadTasks();
        setError(null);
      } catch (err) {
        if (err.status === 401) return logout();
        setError(err.message);
      }
    },
    [loadTasks, logout],
  );

  // Carga inicial, só quando há sessão. Os dados vêm de fora, por isso são um efeito.
  useEffect(() => {
    if (!authenticated) return;
    loadTasks().catch((err) => {
      if (err.status === 401) logout();
      else setError(err.message);
    });
  }, [authenticated, loadTasks, logout]);

  // Polling: pede as estatísticas a cada 3s. A função de limpeza cancela o timer ao desmontar o componente.
  useEffect(() => {
    if (!authenticated) return;
    const loadStats = () => api.getStats().then(setStats).catch(() => {});
    loadStats();
    const timer = setInterval(loadStats, STATS_POLL_MS);
    return () => clearInterval(timer);
  }, [authenticated]);

  if (!authenticated) {
    return (
      <main>
        <h1>Gestor de tarefas</h1>
        <AuthForm
          // key: quando a configuração chega, o formulário é recriado e recebe o erro inicial atualizado
          key={authConfig ? 'ready' : 'loading'}
          oidc={authConfig?.oidc ?? null}
          initialError={loginError}
          onAuthenticated={() => setAuthenticated(true)}
        />
      </main>
    );
  }

  const handleCreate = (title) => run(() => api.createTask(title));
  const handleToggle = (task) => run(() => api.setDone(task.id, !task.done));
  const handleDelete = (id) => run(() => api.removeTask(id));

  return (
    <main>
      <header className="app-header">
        <h1>Gestor de tarefas</h1>
        <button type="button" className="link" onClick={logout}>Terminar sessão</button>
      </header>
      <StatsBar stats={stats} />
      <TaskForm onCreate={handleCreate} />
      {error && <p className="error" role="alert">{error}</p>}
      <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
    </main>
  );
}
