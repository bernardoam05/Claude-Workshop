import js from '@eslint/js';
import globals from 'globals';

// Linter: encontra bugs prováveis (variáveis não usadas, comparações estranhas) antes de o código correr.
// Configuração "flat" (ESLint 9+). Corre no CI: um aviso de lint parte o pipeline.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // "_" no início marca um argumento ignorado de propósito (ex.: next nos middlewares de erro).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error', // proíbe ==, que converte tipos de forma surpreendente ("1" == 1)
    },
  },
];
