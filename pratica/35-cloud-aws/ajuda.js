import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { clientesAws } from './clientes.js';

// Os testes só correm com o LocalStack ligado (o verificar.mjs arranca-o e passa o URL).
export function aws() {
  assert.ok(process.env.LOCALSTACK_URL, 'corre estes testes com "npm run verificar 35" (arranca o LocalStack)');
  return clientesAws();
}

// Um nome único por teste, para os testes não se pisarem.
export const unico = (prefixo) => `${prefixo}-${randomUUID().slice(0, 8)}`;
