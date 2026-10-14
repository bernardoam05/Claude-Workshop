import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Servidor de desenvolvimento dos exercícios de estilos: `npm run estilos` (dentro de pratica/)
// e abre http://localhost:5180. Cada vez que gravas um ficheiro, o browser atualiza sozinho.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [tailwindcss(), react()],
  server: { port: 5180 },
});
