// Já feito: a página de demonstração. Mostra todas as variantes dos teus componentes.
// Os teus ficheiros são o Button.jsx e o Badge.jsx.
import { createRoot } from 'react-dom/client';
import '../app.css';
import Badge from './Badge.jsx';
import Button from './Button.jsx';

function Demo() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Botões e etiquetas</h1>

      <h2 className="mb-3 text-lg font-medium">Variantes e tamanhos</h2>
      <section className="mb-8 flex flex-wrap items-center gap-3">
        <Button data-testid="primary">Guardar</Button>
        <Button variant="secondary" data-testid="secondary">
          Cancelar
        </Button>
        <Button variant="danger" data-testid="danger">
          Apagar
        </Button>
        <Button size="sm" data-testid="small">
          Pequeno
        </Button>
        <Button disabled data-testid="disabled">
          Desativado
        </Button>
        <Button aria-label="Fechar janela" data-testid="icon">
          ✕
        </Button>
      </section>

      <h2 className="mb-3 text-lg font-medium">Etiquetas de estado</h2>
      <section className="flex flex-wrap items-center gap-3">
        <Badge status="todo" />
        <Badge status="done" />
        <Badge status="late" />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
