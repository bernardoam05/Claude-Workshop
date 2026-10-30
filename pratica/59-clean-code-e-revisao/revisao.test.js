import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analisarDiff, comentar } from './revisao.js';

const diff = `diff --git a/src/api/src/routes/tasks.js b/src/api/src/routes/tasks.js
index 1a2b3c4..5d6e7f8 100644
--- a/src/api/src/routes/tasks.js
+++ b/src/api/src/routes/tasks.js
@@ -10,6 +10,9 @@ export function tasksRouter(service) {
   router.get('/', async (req, res) => {
-    const tasks = await service.list(req.user.id);
+    const tasks = await service.list(req.user.id, req.query);
+    console.log('tarefas', tasks.length);
+    // TODO: paginação
     res.json(tasks);
   });
@@ -40,3 +43,4 @@ export function tasksRouter(service) {
   router.delete('/:id', async (req, res) => {
+    debugger;
     await service.remove(req.params.id);
diff --git a/src/api/test/tasks.test.js b/src/api/test/tasks.test.js
--- a/src/api/test/tasks.test.js
+++ b/src/api/test/tasks.test.js
@@ -1,2 +1,3 @@
 import { it } from 'node:test';
-it('lista', async () => {});
+it.only('lista', async () => {});
+// TODO(PROJ-42): testar a paginação
diff --git a/config/antigo.env b/config/antigo.env
deleted file mode 100644
--- a/config/antigo.env
+++ /dev/null
@@ -1,2 +0,0 @@
-A=1
-B=2
diff --git a/src/api/src/config.js b/src/api/src/config.js
new file mode 100644
--- /dev/null
+++ b/src/api/src/config.js
@@ -0,0 +1,3 @@
+export const awsKey = 'AKIAIOSFODNN7EXAMPLE';
+export const token = process.env.TOKEN;
+export const password = "uma-password-longa";`;

describe('P3 · analisarDiff', () => {
  it('conta as linhas por ficheiro, incluindo apagados e novos', () => {
    assert.deepEqual(analisarDiff(diff), [
      { ficheiro: 'src/api/src/routes/tasks.js', adicionadas: 4, removidas: 1 },
      { ficheiro: 'src/api/test/tasks.test.js', adicionadas: 2, removidas: 1 },
      { ficheiro: 'config/antigo.env', adicionadas: 0, removidas: 2 },
      { ficheiro: 'src/api/src/config.js', adicionadas: 3, removidas: 0 },
    ]);
  });
});

describe('P3 · comentar', () => {
  it('comenta as linhas acrescentadas, com o número da linha no ficheiro novo', () => {
    assert.deepEqual(comentar(diff), [
      { ficheiro: 'src/api/src/routes/tasks.js', linha: 12, mensagem: 'console.log esquecido' },
      { ficheiro: 'src/api/src/routes/tasks.js', linha: 13, mensagem: 'TODO sem ticket' },
      { ficheiro: 'src/api/src/routes/tasks.js', linha: 44, mensagem: 'debugger esquecido' },
      { ficheiro: 'src/api/test/tasks.test.js', linha: 2, mensagem: 'teste com .only: os outros não correm' },
      { ficheiro: 'src/api/src/config.js', linha: 1, mensagem: 'possível segredo' },
      { ficheiro: 'src/api/src/config.js', linha: 3, mensagem: 'possível segredo' },
    ]);
  });
  it('.only só conta nos ficheiros de teste, e as linhas removidas não se comentam', () => {
    const d = `--- a/src/x.js\n+++ b/src/x.js\n@@ -1,1 +1,2 @@\n-console.log(1);\n+const lista = valores.only(2);`;
    assert.deepEqual(comentar(d), []);
  });
  it('uma chave privada', () => {
    const d = `--- /dev/null\n+++ b/id_rsa\n@@ -0,0 +1,2 @@\n+-----BEGIN OPENSSH PRIVATE KEY-----\n+abc`;
    assert.deepEqual(comentar(d), [{ ficheiro: 'id_rsa', linha: 1, mensagem: 'possível segredo' }]);
  });
});
