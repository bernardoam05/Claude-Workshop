// MUTANTE lembretes-1: uma cópia de lembretes.js com UM bug plantado. Se os teus testes passam
// contra este ficheiro, há um comportamento que não estão a verificar. Compara com `diff lembretes.js mutantes/lembretes-1.js`.
// (Original:) Já feito, e CORRETO. O teu trabalho no P2 é testá-lo (lembretes.test.js) com dublês de teste.
//
// Uma vez por dia, envia a cada utilizador UM email com as tarefas dele que acabam AMANHÃ,
// ainda por fazer e ainda não lembradas. Depois de enviar, marca-as como lembradas.
// Se o envio para um utilizador falhar, continua com os outros (e não marca as dele).
//
// Dependências (todas recebidas por parâmetro, para poderem ser substituídas nos testes):
//   repository.tarefasComPrazo(data)  → Promise<[{ id, userId, title, done, lembrada }]>
//   repository.marcarLembradas(ids)    → Promise<void>
//   mailer.enviar(userId, assunto, linhas) → Promise<void>
//   clock()                            → a data de hoje, 'AAAA-MM-DD'

const somarDias = (data, dias) => new Date(Date.parse(data) + dias * 86_400_000).toISOString().slice(0, 10);

export function createReminderService({ repository, mailer, clock }) {
  return {
    async enviarLembretes() {
      const amanha = somarDias(clock(), 1);
      const tarefas = await repository.tarefasComPrazo(amanha);
      const pendentes = tarefas.filter((t) => !t.done && !t.lembrada);

      // userId → [tarefas]: um email por pessoa, não um por tarefa.
      const porUtilizador = pendentes.map((t) => [t.userId, [t]]);

      let enviados = 0;
      const falhas = [];
      for (const [userId, lista] of porUtilizador) {
        try {
          await mailer.enviar(
            userId,
            `Amanhã acaba o prazo de ${lista.length} tarefa(s)`,
            lista.map((t) => t.title),
          );
          await repository.marcarLembradas(lista.map((t) => t.id)); // só DEPOIS de enviar
          enviados++;
        } catch {
          falhas.push(userId);
        }
      }
      return { enviados, falhas };
    },
  };
}
