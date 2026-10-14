// Já feito: a página de demonstração, com casos difíceis de propósito (um título enorme,
// uma tarefa sem prazo, uma atrasada, uma feita). Os teus ficheiros são o TaskCard.jsx e o TaskGrid.jsx.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../app.css';
import TaskGrid from './TaskGrid.jsx';

const INICIAIS = [
  { id: 1, title: 'Escrever o capítulo 2 da dissertação', done: false, due: '2026-10-20', late: false },
  {
    id: 2,
    title: 'Rever a bibliografia toda e confirmar que todas as referências seguem a norma APA sétima edição sem exceções',
    done: false,
    due: '2026-10-10',
    late: true,
  },
  { id: 3, title: 'Marcar reunião com o orientador', done: true, due: '2026-10-08', late: false },
  { id: 4, title: 'Ler o artigo sobre outbox', done: false, due: null, late: false },
];

function Demo() {
  const [tasks, setTasks] = useState(INICIAIS);
  const toggle = (id) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id) => setTasks((ts) => ts.filter((t) => t.id !== id));

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold">As tuas tarefas</h1>
      <TaskGrid tasks={tasks} onToggle={toggle} onDelete={remove} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
