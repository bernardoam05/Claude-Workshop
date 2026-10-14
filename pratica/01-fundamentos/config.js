// P1 · Ler configuração do ambiente (ver docs/01-fundamentos.md, secção "Prática").
//
// loadConfig(env) recebe um objeto como process.env (tudo strings, ou undefined) e devolve:
//   { port: number, nodeEnv: string, isProduction: boolean, databaseUrl: string | null }
//
// Regras:
//   - PORT é opcional; por omissão 3000. Tem de ser um inteiro entre 1 e 65535,
//     senão lança um Error cuja mensagem contém "PORT".
//   - NODE_ENV é opcional; por omissão "development".
//   - DATABASE_URL é opcional em desenvolvimento (null se faltar),
//     mas OBRIGATÓRIA em produção: lança um Error cuja mensagem contém "DATABASE_URL".
export function loadConfig(env) {
  throw new Error('Por fazer: P1');
}
