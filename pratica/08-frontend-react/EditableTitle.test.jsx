import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditableTitle from './EditableTitle.jsx';

describe('P2 · EditableTitle', () => {
  it('em modo leitura mostra o título e o botão Editar, e nenhum campo', () => {
    render(<EditableTitle title="Estudar React" onSave={() => {}} />);
    expect(screen.getByText('Estudar React')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Editar abre um campo preenchido e já com o foco', async () => {
    const user = userEvent.setup();
    render(<EditableTitle title="Estudar React" onSave={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    const campo = screen.getByLabelText('Título');
    expect(campo.value).toBe('Estudar React');
    expect(document.activeElement).toBe(campo);
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('Enter guarda o texto sem espaços nas pontas e volta ao modo leitura', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditableTitle title="Velho" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Título'));
    await user.type(screen.getByLabelText('Título'), '  Novo  {Enter}');

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Novo');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('o botão Guardar também guarda', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditableTitle title="Velho" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.type(screen.getByLabelText('Título'), '!');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Velho!');
  });

  it('texto vazio ou igual ao original não chama onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditableTitle title="Igual" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.type(screen.getByLabelText('Título'), '{Enter}');
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Título'));
    await user.type(screen.getByLabelText('Título'), '   {Enter}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Escape cancela, e a próxima edição começa outra vez do título original', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EditableTitle title="Original" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.type(screen.getByLabelText('Título'), ' rascunho{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Título').value).toBe('Original');
  });
});
