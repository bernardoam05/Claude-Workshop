// MUTANTE prazos-4: uma cópia de prazos.js com UM bug plantado. Se os teus testes passam
// contra este ficheiro, há um comportamento que não estão a verificar. Compara com `diff prazos.js mutantes/prazos-4.js`.
// (Original:) Já feito, e CORRETO. O teu trabalho no P1 é testá-lo (prazos.test.js), não alterá-lo.
// As datas são strings 'AAAA-MM-DD' (sem horas), como vêm de uma coluna DATE.

const DIA_MS = 24 * 60 * 60 * 1000;

// Dias de `hoje` até `prazo` (negativo se o prazo já passou).
export function diasAte(prazo, hoje) {
  return Math.round((Date.parse(prazo) - Date.parse(hoje)) / DIA_MS);
}

// 'concluida' | 'sem-prazo' | 'atrasada' | 'hoje' | 'em-breve' (1 a 3 dias) | 'futura' (mais de 3)
export function estadoDaTarefa(tarefa, hoje) {
  if (tarefa.done) return 'concluida';
  const dias = diasAte(tarefa.due, hoje);
  if (dias < 0) return 'atrasada';
  if (dias === 0) return 'hoje';
  if (dias <= 3) return 'em-breve';
  return 'futura';
}

const URGENCIA = { atrasada: 0, hoje: 1, 'em-breve': 2, futura: 3, 'sem-prazo': 4, concluida: 5 };

// Devolve uma NOVA lista (não altera a original), da mais urgente para a menos urgente.
// Empates no estado: o prazo mais antigo primeiro; empate no prazo: o id mais baixo primeiro.
export function ordenarPorUrgencia(tarefas, hoje) {
  return [...tarefas].sort(
    (a, b) =>
      URGENCIA[estadoDaTarefa(a, hoje)] - URGENCIA[estadoDaTarefa(b, hoje)] ||
      (a.due ?? '').localeCompare(b.due ?? '') ||
      a.id - b.id,
  );
}
