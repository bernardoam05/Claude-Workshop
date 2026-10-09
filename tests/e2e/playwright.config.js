import { defineConfig } from '@playwright/test';

// Testes E2E: um browser real a usar a aplicação como um utilizador. Precisam do sistema a correr (compose).
// BASE_URL permite apontar para outra porta (ex.: WEB_PORT=8081).
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0, // no CI, uma repetição: absorve uma falha de rede pontual, não esconde bugs
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure', // em caso de falha, guarda um "filme" do teste para depurar (npx playwright show-trace)
  },
});
