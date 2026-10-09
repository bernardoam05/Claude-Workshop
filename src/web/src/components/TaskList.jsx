// Componente de apresentação: recebe dados e callbacks por props e não tem estado próprio.
// Quanto menos estado um componente tem, mais fácil é de perceber e de testar.
export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return <p className="empty">Sem tarefas. Adiciona a primeira!</p>;
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        // key: identificador estável para o React saber qual item mudou (não usar o índice do array).
        <li key={task.id} className={task.done ? 'done' : undefined}>
          <label>
            <input type="checkbox" checked={task.done} onChange={() => onToggle(task)} />
            <span>{task.title}</span>
          </label>
          <button
            type="button"
            className="delete"
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
