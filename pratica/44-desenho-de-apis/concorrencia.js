// P4 · Atualizações seguras numa API: If-Match (sem atualizações perdidas) e JSON Merge Patch.
import { createServer } from 'node:http';

// aplicarMergePatch(alvo, patch) → um objeto NOVO (RFC 7396):
//   - se o patch não for um objeto (ou for um array), o resultado é o próprio patch
//   - senão, para cada chave do patch: null → apaga a chave; um objeto → merge recursivo com o
//     valor atual (ou {} se não for um objeto); outro valor → substitui
//   O alvo não é alterado.
export function aplicarMergePatch(alvo, patch) {
  throw new Error('Por fazer: P4');
}

// criarServidor(tarefas) → um http.Server com uma só rota, /tarefas/:id, sobre um Map id → tarefa.
//   Cada tarefa guardada tem uma versão (começa em 1 e sobe a cada alteração); o ETag é '"<versão>"'.
//   GET     → 200 com a tarefa (JSON) e o ETag; 404 se não existir
//   PATCH   → corpo em application/merge-patch+json; aplica com aplicarMergePatch
//             - sem If-Match → 428 (Precondition Required): obriga o cliente a dizer que versão viu
//             - If-Match diferente do ETag atual → 412 (Precondition Failed): alguém mudou entretanto
//             - Content-Type diferente de application/merge-patch+json → 415
//             - corpo que não é JSON → 400
//             - senão → 200 com a tarefa nova e o ETag novo
//   Rota ou método desconhecido → 404 / 405. (Os erros podem ir sem corpo.)
export function criarServidor(tarefas) {
  throw new Error('Por fazer: P4');
}
