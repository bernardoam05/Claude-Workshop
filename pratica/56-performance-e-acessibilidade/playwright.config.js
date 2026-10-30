import { defineConfig } from '@playwright/test';

// Acessibilidade e desempenho só se medem num browser a sério. Usa o Google Chrome instalado
// (channel: 'chrome'); sem ele: `npx playwright install chromium` e PW_CHANNEL=chromium.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  reporter: [['list']],
  timeout: 30_000,
  workers: 1, // as medições de tempo ficam mais estáveis sem testes em paralelo
  use: {
    baseURL: 'http://localhost:5182',
    channel: process.env.PW_CHANNEL ?? 'chrome',
    actionTimeout: 3000, // um botão que não existe falha ao fim de 3 s, e não de 30
  },
  webServer: {
    command: 'node servidor.mjs 5182',
    cwd: import.meta.dirname,
    url: 'http://localhost:5182/p1-acessivel/',
    reuseExistingServer: false,
  },
});
