// P3 · Testes de mutação: quem testa os testes? Muda-se o código de propósito (um < passa a <=,
// um + a -) e corre-se os testes. Se continuarem a passar, o "mutante sobreviveu": os testes não
// estavam a verificar aquela linha a sério. (O Stryker faz isto para projetos inteiros.)

// As mutações: cada operador encontrado no código é trocado pelo seu par.
export const MUTACOES = {
  '<': '<=', '<=': '<', '>': '>=', '>=': '>',
  '===': '!==', '!==': '===',
  '&&': '||', '||': '&&',
  '+': '-', '-': '+',
  true: 'false', false: 'true',
};

// gerarMutantes(codigo) → [{ descricao, codigo }], um mutante por cada ocorrência de um operador
//   de MUTACOES, pela ordem em que aparecem no código.
//   descricao: "linha 2: '<' → '<='" (linhas a contar de 1)
//   Cuidado: '<=' é UM operador (não é '<' seguido de '='), '===' também, e '=>', '++', '--',
//   '+=' e '-=' não se mudam. true/false só como palavras inteiras.
//   (Simplificação: o código não tem textos nem comentários com estes símbolos.)
export function gerarMutantes(codigo) {
  throw new Error('Por fazer: P3');
}

// avaliarMutantes(codigo, testes) → { total, mortos, sobreviventes, pontuacao }
//   codigo: o texto de UMA expressão de função ('(a, b) => a < b ? a : b' ou 'function (x) {...}')
//   testes: (f) => void, lança um erro se f estiver errada (ex.: usa assert lá dentro)
//   - compila com new Function(`return (${codigo})`)()
//   - se os testes falharem com o código original → lança Error('Os testes falham com o código original')
//   - um mutante "morre" se os testes lançarem um erro com ele; "sobrevive" se passarem
//   - mutantes que não compilam (SyntaxError) não contam
//   - sobreviventes: as descrições dos que sobreviveram
//   - pontuacao: mortos / total, arredondada a 2 casas (sem mutantes → 1)
export function avaliarMutantes(codigo, testes) {
  throw new Error('Por fazer: P3');
}
