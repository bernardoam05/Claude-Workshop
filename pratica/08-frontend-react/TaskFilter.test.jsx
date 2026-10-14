import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TaskFilter from './TaskFilter.jsx';

const tasks = [
  { id: 1, title: 'Estudar Docker', done: true },
  { id: 2, title: 'Ler sobre React', done: false },
  { id: 3, title: 'Configurar o docker-compose', done: false },
];

// Os títulos que estão no ecrã, pela ordem. É o que o utilizador vê, não o estado interno.
const titulosVisiveis = () =>
  screen.queryAllByRole('listitem').map((li) => li.textContent.trim());

describe('P1 · TaskFilter', () => {
  it('começa a mostrar todas as tarefas e a contagem', () => {
    render(<TaskFilter tasks={tasks} />);
    expect(titulosVisiveis()).toEqual(['Estudar Docker', 'Ler sobre React', 'Configurar o docker-compose']);
    expect(screen.getByText('3 de 3 tarefas')).toBeTruthy();
  });

  it('o campo "Procurar" é controlado e filtra sem distinguir maiúsculas', async () => {
    const user = userEvent.setup();
    render(<TaskFilter tasks={tasks} />);
    const campo = screen.getByLabelText('Procurar');

    await user.type(campo, 'DOCKER');
    expect(campo.value).toBe('DOCKER');
    expect(titulosVisiveis()).toEqual(['Estudar Docker', 'Configurar o docker-compose']);
    expect(screen.getByText('2 de 3 tarefas')).toBeTruthy();
  });

  it('o select "Estado" tem as três opções e filtra', async () => {
    const user = userEvent.setup();
    render(<TaskFilter tasks={tasks} />);
    const select = screen.getByLabelText('Estado');
    expect(within(select).getAllByRole('option').map((o) => [o.value, o.textContent])).toEqual([
      ['todas', 'Todas'],
      ['por-fazer', 'Por fazer'],
      ['feitas', 'Feitas'],
    ]);

    await user.selectOptions(select, 'feitas');
    expect(titulosVisiveis()).toEqual(['Estudar Docker']);
    await user.selectOptions(select, 'por-fazer');
    expect(titulosVisiveis()).toEqual(['Ler sobre React', 'Configurar o docker-compose']);
  });

  it('os dois filtros juntam-se', async () => {
    const user = userEvent.setup();
    render(<TaskFilter tasks={tasks} />);
    await user.type(screen.getByLabelText('Procurar'), 'docker');
    await user.selectOptions(screen.getByLabelText('Estado'), 'por-fazer');
    expect(titulosVisiveis()).toEqual(['Configurar o docker-compose']);
    expect(screen.getByText('1 de 3 tarefas')).toBeTruthy();
  });

  it('sem resultados: mostra uma mensagem e não mostra a lista', async () => {
    const user = userEvent.setup();
    render(<TaskFilter tasks={tasks} />);
    await user.type(screen.getByLabelText('Procurar'), 'kubernetes');
    expect(screen.getByText('Nenhuma tarefa corresponde ao filtro')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('se as tarefas (props) mudarem, o filtro aplica-se às novas: nada de copiar props para estado', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TaskFilter tasks={tasks} />);
    await user.type(screen.getByLabelText('Procurar'), 'docker');
    rerender(<TaskFilter tasks={[...tasks, { id: 4, title: 'Docker Swarm', done: false }]} />);
    expect(titulosVisiveis()).toEqual(['Estudar Docker', 'Configurar o docker-compose', 'Docker Swarm']);
  });
});
