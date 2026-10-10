// Mostra dois tipos de número com garantias diferentes:
// - total/concluídas: lidos diretamente da tabela tasks (imediatos);
// - processadas pelo worker: dependem da fila (atrasados alguns segundos).
export default function StatsBar({ stats }) {
  if (!stats) return null;

  return (
    <section className="mb-5 grid grid-cols-3 gap-3">
      <div className="flex flex-col rounded-[10px] border border-border bg-surface p-3">
        <strong className="text-xl">{stats.total}</strong>
        <span className="text-xs text-muted">total</span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-border bg-surface p-3">
        <strong className="text-xl">{stats.done}</strong>
        <span className="text-xs text-muted">concluídas</span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-border bg-surface p-3">
        <strong className="text-xl">{stats.processedCompleted}</strong>
        <span className="text-xs text-muted">processadas pelo worker</span>
      </div>
    </section>
  );
}
