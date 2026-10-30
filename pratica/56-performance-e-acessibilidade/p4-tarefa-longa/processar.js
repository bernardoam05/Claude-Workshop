// P4 · Uma tarefa longa sem bloquear a página.

// trabalho(n): simula ~2 ms de CPU por item (não mexas nesta função).
export function trabalho(n) {
  const fim = performance.now() + 2;
  while (performance.now() < fim);
  return n * 2;
}

// processarTudo(itens, aoProgresso) → Promise com a soma de trabalho(i) para todos os itens
//   Chama aoProgresso(feitos) de vez em quando (e no fim, com o total).
//   Nunca pode ocupar o browser mais de ~50 ms seguidos: processa em blocos e cede entre eles.
//   Esta versão funciona, mas bloqueia a página ~600 ms: nem o progresso nem os cliques mexem.
export async function processarTudo(itens, aoProgresso = () => {}) {
  let soma = 0;
  for (let i = 0; i < itens.length; i++) {
    soma += trabalho(itens[i]);
    aoProgresso(i + 1);
  }
  return soma;
}
