import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Só os testes .jsx (componentes React) correm no Vitest: precisam de um DOM falso (jsdom)
// e de perceber JSX. Os restantes usam o node --test, como a API em src/api.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true, // permite ao Testing Library limpar o DOM sozinho entre testes
    include: ['**/*.test.jsx'],
  },
});
