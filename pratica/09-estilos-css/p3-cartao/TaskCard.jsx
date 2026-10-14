// P3 · O cartão de uma tarefa (ver docs/09-estilos-css.md, secção "Prática").
// Isto já funciona, mas não tem estilo nenhum. Reutiliza o Button e o Badge do P2.
import Badge from '../p2-componentes/Badge.jsx';
import Button from '../p2-componentes/Button.jsx';

export default function TaskCard({ task, onToggle, onDelete }) {
  return (
    <article>
      <div>
        <h3>{task.title}</h3>
        <p>
          <Badge status={task.done ? 'done' : task.late ? 'late' : 'todo'} />
          {task.due && <span>Prazo: {task.due}</span>}
        </p>
      </div>
      <div>
        <Button onClick={() => onToggle(task.id)}>{task.done ? 'Reabrir' : 'Concluir'}</Button>
        <Button onClick={() => onDelete(task.id)} aria-label={`Apagar ${task.title}`}>
          Apagar
        </Button>
      </div>
    </article>
  );
}
