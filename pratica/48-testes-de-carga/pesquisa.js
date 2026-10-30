// P3 · A pesquisa de tarefas. Ver docs/48-testes-de-carga.md, secção "Prática".
//
// FUNCIONA, mas é lenta: sob carga, a API inteira fica lenta (o Node só tem uma thread a correr
// JavaScript, e enquanto esta função corre, nenhum outro pedido é atendido, nem o /health).
// Torna-a rápida SEM mudar o resultado:
//   - procura sem distinguir maiúsculas, em qualquer parte do título
//   - devolve no máximo 20 tarefas, ordenadas pelo título (localeCompare em "pt")
//   - texto vazio → as 20 primeiras por ordem de título
// As tarefas podem ser acrescentadas entre pesquisas (o POST): o resultado tem de as incluir.
export function procurar(tarefas, texto) {
  const ordenadas = [...tarefas].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt'));
  const resultado = [];
  for (const t of ordenadas) {
    const padrao = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (padrao.test(t.titulo)) resultado.push(t);
  }
  return resultado.slice(0, 20);
}
