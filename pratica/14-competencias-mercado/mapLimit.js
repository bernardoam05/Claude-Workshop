// P3 · Processar uma lista de tarefas assíncronas com um LIMITE de concorrência
// (ver docs/14, secção "Prática").
//
// mapLimit(itens, limite, fn) → Promise com os resultados de fn(item, indice), PELA ORDEM dos itens.
//   - nunca há mais do que `limite` chamadas de fn a decorrer ao mesmo tempo;
//   - assim que uma acaba, começa a seguinte (não se espera pelo "lote" inteiro);
//   - se uma falhar, a Promise rejeita com esse erro e não se começam itens novos.
// (ex.: descarregar 1000 ficheiros, mas só 5 de cada vez, para não rebentar a rede)
export async function mapLimit(itens, limite, fn) {
  throw new Error('Por fazer: P3');
}
