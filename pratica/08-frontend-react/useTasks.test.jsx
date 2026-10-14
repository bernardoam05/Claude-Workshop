import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTasks } from './useTasks.js';

// Uma API falsa em memória. `controlo` permite deixar uma chamada "pendurada" ou fazê-la falhar.
function fakeApi(inicial = []) {
  let tasks = structuredClone(inicial);
  let nextId = 100;
  const controlo = { falhaSetDone: false, falhaList: false, pendente: null };
  return {
    controlo,
    async list() {
      if (controlo.falhaList) throw new Error('API indisponível');
      return structuredClone(tasks);
    },
    async create(title) {
      const task = { id: nextId++, title, done: false };
      tasks.push(task);
      return { ...task };
    },
    async setDone(id, done) {
      // Fica à espera até o teste decidir: assim conseguimos ver o ecrã ANTES de a API responder.
      await new Promise((resolve) => (controlo.pendente = resolve));
      if (controlo.falhaSetDone) throw new Error('Não foi possível guardar');
      tasks = tasks.map((t) => (t.id === id ? { ...t, done } : t));
      return tasks.find((t) => t.id === id);
    },
    async remove(id) {
      tasks = tasks.filter((t) => t.id !== id);
    },
  };
}

const inicial = [
  { id: 1, title: 'A', done: false },
  { id: 2, title: 'B', done: true },
];

describe('P3 · useTasks', () => {
  it('carrega ao montar: loading primeiro, depois as tarefas', async () => {
    // A api é criada FORA do renderHook: se fosse criada lá dentro, cada render teria uma api nova.
    const api = fakeApi(inicial);
    const { result } = renderHook(() => useTasks(api));
    expect(result.current.loading).toBe(true);
    expect(result.current.tasks).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual(inicial);
    expect(result.current.error).toBeNull();
  });

  it('se a lista falhar: error com a mensagem e loading a false', async () => {
    const api = fakeApi(inicial);
    api.controlo.falhaList = true;
    const { result } = renderHook(() => useTasks(api));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('API indisponível');
  });

  it('addTask acrescenta a tarefa devolvida pela API ao fim da lista', async () => {
    const api = fakeApi(inicial);
    const { result } = renderHook(() => useTasks(api));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.addTask('C'));
    expect(result.current.tasks.map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('toggleTask é otimista: o ecrã muda ANTES de a API responder', async () => {
    const api = fakeApi(inicial);
    const { result } = renderHook(() => useTasks(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pedido;
    act(() => {
      pedido = result.current.toggleTask(result.current.tasks[0]);
    });
    expect(result.current.tasks[0].done).toBe(true); // a API ainda não respondeu

    await act(async () => {
      api.controlo.pendente();
      await pedido;
    });
    expect(result.current.tasks[0].done).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('se o toggle falhar na API, desfaz a mudança e mostra o erro', async () => {
    const api = fakeApi(inicial);
    api.controlo.falhaSetDone = true;
    const { result } = renderHook(() => useTasks(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pedido;
    act(() => {
      pedido = result.current.toggleTask(result.current.tasks[1]);
    });
    expect(result.current.tasks[1].done).toBe(false);

    await act(async () => {
      api.controlo.pendente();
      await pedido;
    });
    expect(result.current.tasks[1].done).toBe(true); // voltou ao que era
    expect(result.current.error).toBe('Não foi possível guardar');
  });

  it('removeTask tira a tarefa da lista, e uma ação bem-sucedida limpa o erro anterior', async () => {
    const api = fakeApi(inicial);
    api.controlo.falhaSetDone = true;
    const { result } = renderHook(() => useTasks(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pedido;
    act(() => {
      pedido = result.current.toggleTask(result.current.tasks[0]);
    });
    await act(async () => {
      api.controlo.pendente();
      await pedido;
    });
    expect(result.current.error).not.toBeNull();

    await act(() => result.current.removeTask(2));
    expect(result.current.tasks.map((t) => t.id)).toEqual([1]);
    expect(result.current.error).toBeNull();
  });
});
