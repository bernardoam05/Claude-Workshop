// P5 · Grafos: BFS, DFS, ordenação topológica e Dijkstra.

// caminhoMaisCurto(grelha): grelha é um array de strings, "." é livre, "#" é parede, "S" a partida e
// "E" a chegada. Devolve o número MÍNIMO de passos (cima, baixo, esquerda, direita) de S a E, ou -1.
// (Busca em largura: BFS.)
export function caminhoMaisCurto(grelha) {
  throw new Error('Por fazer: P5');
}

// contarIlhas(grelha): "1" é terra, "0" é água; uma ilha são "1"s ligados na horizontal ou vertical.
export function contarIlhas(grelha) {
  throw new Error('Por fazer: P5');
}

// ordemTopologica(tarefas, dependencias): dependencias é uma lista de [antes, depois].
// Devolve uma ordem das tarefas em que cada uma vem depois de todas as suas dependências; quando há
// várias possíveis, escolhe sempre a tarefa disponível que aparece PRIMEIRO na lista "tarefas".
// Se houver um ciclo, Error com "ciclo".
export function ordemTopologica(tarefas, dependencias) {
  throw new Error('Por fazer: P5');
}

// dijkstra(arestas, origem): arestas é uma lista de [de, para, custo] (custos >= 0, ligações num só
// sentido). Devolve um objeto { nó: menor custo desde a origem } só com os nós alcançáveis.
// Usa o MinHeap do P4.
export function dijkstra(arestas, origem) {
  throw new Error('Por fazer: P5');
}
