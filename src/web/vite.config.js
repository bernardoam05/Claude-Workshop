import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // tailwindcss() tem de vir antes do react(): processa o CSS (incluindo as classes usadas
  // dentro dos .jsx) antes do plugin do React entrar em ação.
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    // Em desenvolvimento, o Vite reencaminha /api para a API local.
    // Para o browser, tudo parece vir da mesma origem: não há problemas de CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
