// P3 · A grelha de cartões (ver docs/09-estilos-css.md, secção "Prática").
// Isto já funciona, mas os cartões ficam uns por baixo dos outros, sem grelha.
import TaskCard from './TaskCard.jsx';

export default function TaskGrid({ tasks, onToggle, onDelete }) {
  return (
    <div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
}
