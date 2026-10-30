// P4 · Uma saga orquestrada: uma operação que atravessa vários serviços, sem uma transação que os junte.
//
// executarSaga(passos, contexto) → { sucesso, registo }
//   passos: [{ nome, executar(contexto), compensar(contexto) }] (as funções podem ser assíncronas)
//   - executa os passos por ordem; cada um pode pôr coisas no contexto (ex.: o id da reserva)
//   - se um passo falhar: COMPENSA os passos que já tinham corrido, pela ordem INVERSA
//     (o que falhou não se compensa: não chegou a acontecer), e devolve sucesso false
//   - se uma compensação falhar, regista-o e continua a compensar os restantes (não se pode parar a
//     meio: o resto do sistema ficaria inconsistente), e devolve sucesso false
//   - registo: uma linha por acontecimento, por ordem, no formato
//       "ok: <nome>" · "falhou: <nome>: <mensagem>" · "compensado: <nome>" · "compensação falhou: <nome>: <mensagem>"
export async function executarSaga(passos, contexto = {}) {
  throw new Error('Por fazer: P4');
}
