import { useState } from 'react';

// Componente CONTROLADO: o valor do input vive no estado do React, não no DOM.
// Assim o React é sempre a fonte de verdade sobre o que está escrito.
export default function TaskForm({ onCreate }) {
  const [title, setTitle] = useState('');

  async function handleSubmit(event) {
    // Por omissão, um <form> recarrega a página. preventDefault() impede isso.
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    await onCreate(trimmed);
    setTitle('');
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Nova tarefa..."
        maxLength={200}
        aria-label="Título da tarefa"
      />
      <button type="submit">Adicionar</button>
    </form>
  );
}
