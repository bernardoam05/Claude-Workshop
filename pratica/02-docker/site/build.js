// "Compila" o site: gera dist/index.html a partir de um modelo. É um passo de build a sério
// em miniatura (como o `vite build` do src/web): precisa de Node para correr, mas o resultado
// são só ficheiros estáticos, que qualquer servidor web entrega sem Node.
import { mkdirSync, writeFileSync } from 'node:fs';

const builtAt = new Date().toISOString();
mkdirSync('dist', { recursive: true });
writeFileSync(
  'dist/index.html',
  `<!doctype html>
<html lang="pt">
  <head><meta charset="utf-8"><title>Prática 02</title></head>
  <body>
    <h1>Construído com um multi-stage build</h1>
    <p>Gerado em ${builtAt}. Esta imagem já não tem Node lá dentro.</p>
  </body>
</html>
`,
);
console.log('dist/index.html gerado');
