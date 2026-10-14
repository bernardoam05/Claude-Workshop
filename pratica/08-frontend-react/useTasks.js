// P3 · Um hook próprio que esconde dos componentes o carregamento, os erros e as atualizações.
//
// useTasks(api) recebe um objeto com: list(), create(title), setDone(id, done), remove(id)
// (todas devolvem Promises, como o src/web/src/api.js) e devolve:
//   { tasks, loading, error, addTask, toggleTask, removeTask }
//
//   - ao montar, carrega a lista: loading=true até chegar; se falhar, error=<mensagem do erro>
//   - addTask(title): cria na API e acrescenta a tarefa devolvida ao fim da lista (sem recarregar)
//   - toggleTask(task): OTIMISTA. Muda o `done` no ecrã logo, ANTES de a API responder;
//                       se a API falhar, desfaz a mudança e põe error=<mensagem>
//   - removeTask(id): remove na API e depois tira da lista
//   - qualquer ação que corra bem limpa um error anterior (error=null)
//
// Ver docs/08-frontend-react.md, secção "Prática".
export function useTasks(api) {
  throw new Error('Por fazer: P3');
}
