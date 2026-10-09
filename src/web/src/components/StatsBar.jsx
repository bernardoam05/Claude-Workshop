// Mostra dois tipos de número com garantias diferentes:
// - total/concluídas: lidos diretamente da tabela tasks (imediatos);
// - processadas pelo worker: dependem da fila (atrasados alguns segundos).
export default function StatsBar({ stats }) {
  if (!stats) return null;

  return (
    <section className="stats">
      <div>
        <strong>{stats.total}</strong>
        <span>total</span>
      </div>
      <div>
        <strong>{stats.done}</strong>
        <span>concluídas</span>
      </div>
      <div>
        <strong>{stats.processedCompleted}</strong>
        <span>processadas pelo worker</span>
      </div>
    </section>
  );
}
