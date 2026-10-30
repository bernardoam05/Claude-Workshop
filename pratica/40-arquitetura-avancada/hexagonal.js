// P3 · Arquitetura hexagonal (portas e adaptadores): o caso de uso não sabe se fala com o Postgres ou
// com um array, com o SMTP ou com um teste.
//
// As PORTAS (interfaces) de que o caso de uso precisa, descritas em JSDoc:
//   repositorio: { tarefasAtrasadas(agora: Date): Promise<{ id, titulo, dono: { email, nome }, prazo: Date }[]>,
//                  marcarLembrada(id): Promise<void> }
//   enviador:    { enviar({ para, assunto, texto }): Promise<void> }
//   relogio:     { agora(): Date }

// criarLembretes({ repositorio, enviador, relogio }) → { executar(): Promise<{ enviados, falhados }> }
//   executar():
//   - pede ao repositório as tarefas atrasadas (com o "agora" do relógio)
//   - AGRUPA por dono: um email por pessoa, e não um por tarefa
//     assunto: "Tens N tarefa(s) atrasada(s)" (N tarefas → "Tens 2 tarefas atrasadas"; 1 → "Tens 1 tarefa atrasada")
//     texto: uma linha por tarefa, "- <titulo> (desde <prazo em AAAA-MM-DD>)", pela ordem do prazo
//   - depois de enviar com sucesso, marca cada tarefa desse email como lembrada
//   - se o envio a uma pessoa falhar, não marca as tarefas dela, e continua para as outras pessoas
//   - devolve quantos emails foram enviados e quantos falharam
export function criarLembretes({ repositorio, enviador, relogio }) {
  throw new Error('Por fazer: P3');
}

// Um ADAPTADOR para a porta "enviador", para usar em desenvolvimento: em vez de enviar, guarda os
// emails numa lista (e escreve-os na consola se registar for true).
//   criarEnviadorEmMemoria({ registar = false }) → { enviar, enviados: [] }
export function criarEnviadorEmMemoria({ registar = false } = {}) {
  throw new Error('Por fazer: P3');
}
