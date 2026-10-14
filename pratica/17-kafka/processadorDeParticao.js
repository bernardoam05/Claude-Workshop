// P3 · Processar as mensagens de UMA partição, com tentativas, Dead Letter Topic e offsets
// (ver docs/17-kafka.md, secções 5 e 6, e "Prática").
//
// processarParticao(mensagens, { handle, enviarParaDlt, maxTentativas = 3 })
//   mensagens: [{ offset, value }] já pela ordem da partição (offsets crescentes).
//   Para cada mensagem, POR ORDEM (nunca duas ao mesmo tempo: a ordem dentro da partição importa):
//     - chama await handle(mensagem); se lançar, tenta outra vez, até maxTentativas vezes no total;
//     - se esgotar as tentativas, chama await enviarParaDlt(mensagem, ultimoErro) e segue para a próxima;
//     - se até o enviarParaDlt falhar, PARA: não processa mais nada desta partição.
//   Devolve { offsetParaCommit, processadas, paraDlt }:
//     offsetParaCommit → o offset da PRÓXIMA mensagem a ler (no Kafka, faz-se commit de "último + 1"),
//                        ou null se nem a primeira mensagem ficou tratada
//     processadas      → offsets tratados com sucesso pelo handle
//     paraDlt          → offsets enviados para o DLT
export async function processarParticao(mensagens, { handle, enviarParaDlt, maxTentativas = 3 }) {
  throw new Error('Por fazer: P3');
}
