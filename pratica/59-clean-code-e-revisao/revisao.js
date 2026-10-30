// P3 · Um robô de revisão de código: lê um diff unificado (o que o `git diff` e os pull requests
// mostram) e comenta as linhas acrescentadas, como um revisor atento às coisas mecânicas, para os
// revisores humanos se concentrarem no que importa (o desenho, os nomes, os casos esquecidos).

// analisarDiff(diff) → [{ ficheiro, adicionadas, removidas }], pela ordem do diff
//   O nome vem da linha '+++ b/caminho'; se for '+++ /dev/null' (ficheiro apagado), vem de '--- a/caminho'.
//   adicionadas: linhas que começam por '+' (sem contar a '+++'); removidas: por '-' (sem contar a '---').
export function analisarDiff(diff) {
  throw new Error('Por fazer: P3');
}

// As regras, aplicadas a cada linha ACRESCENTADA (sem o '+'):
//   console.log(                       → 'console.log esquecido'
//   debugger                           → 'debugger esquecido'
//   .only(  (só em ficheiros com .test. ou .spec. no nome) → 'teste com .only: os outros não correm'
//   TODO sem '#123' nem 'ABC-123' na linha → 'TODO sem ticket'
//   AKIA seguido de 16 maiúsculas/algarismos, ou '-----BEGIN ... PRIVATE KEY-----', ou
//   password/secret/token seguido de : ou = e de um texto entre aspas com 8 ou mais caracteres
//                                      → 'possível segredo'
// comentar(diff) → [{ ficheiro, linha, mensagem }], pela ordem do diff e das regras acima.
//   linha é o número da linha no ficheiro NOVO: o cabeçalho '@@ -a,b +c,d @@' diz que a primeira
//   linha do bloco é a c; as linhas de contexto (' ') e as acrescentadas ('+') avançam o contador,
//   as removidas ('-') não.
// Sugestão: uma lista de [expressãoRegular, mensagem, condiçãoNoNomeDoFicheiro?] percorrida para cada linha.

export function comentar(diff) {
  throw new Error('Por fazer: P3');
}
