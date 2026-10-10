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
    <form className="mb-4 flex gap-2" onSubmit={handleSubmit}>
      <input
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Nova tarefa..."
        maxLength={200}
        aria-label="Título da tarefa"
      />
      <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
        Adicionar
      </button>
    </form>
  );
}
