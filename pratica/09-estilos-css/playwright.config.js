import { defineConfig } from '@playwright/test';

// Os testes de estilos precisam de um browser A SÉRIO: só um browser calcula o layout (larguras,
// posições, cores finais). Usa o Google Chrome que já tens instalado (channel: 'chrome').
// Sem Chrome: corre `npx playwright install chromium` e PW_CHANNEL=chromium npm run verificar 09
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  reporter: [['list']],
  timeout: 20_000,
  use: {
    baseURL: 'http://localhost:5181',
    channel: process.env.PW_CHANNEL ?? 'chrome',
  },
  webServer: {
    command: 'npx vite --config vite.config.js --port 5181 --strictPort',
    cwd: import.meta.dirname,
    url: 'http://localhost:5181',
    reuseExistingServer: false,
  },
});
