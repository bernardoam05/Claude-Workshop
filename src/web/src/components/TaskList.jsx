// Componente de apresentação: recebe dados e callbacks por props e não tem estado próprio.
// Quanto menos estado um componente tem, mais fácil é de perceber e de testar.
export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return <p className="text-center text-muted">Sem tarefas. Adiciona a primeira!</p>;
  }

  return (
    <ul className="m-0 list-none p-0">
      {tasks.map((task) => (
        // key: identificador estável para o React saber qual item mudou (não usar o índice do array).
        <li
          key={task.id}
          className="mb-2 flex items-center justify-between rounded-[10px] border border-border bg-surface px-3.5 py-3"
        >
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={task.done} onChange={() => onToggle(task)} />
            <span className={task.done ? 'text-muted line-through' : undefined}>{task.title}</span>
          </label>
          <button
            type="button"
            className="rounded px-2 py-1 text-danger"
            onClick={() => onDelete(task.id)}
            aria-label={`Apagar ${task.title}`}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
