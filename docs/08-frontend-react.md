# 08 · Frontend com React

**Objetivo:** perceber como a interface é **construída** a partir de componentes, como o estado muda a UI, e quando usar um efeito.

**Ficheiros para ler (por esta ordem):** `src/web/src/main.jsx` → `src/web/src/App.jsx` → `src/web/src/components/*.jsx` → `src/web/src/api.js` → `src/web/vite.config.js`.

---

## 1. O modelo mental do React

React resolve um problema: **manter a interface sincronizada com os dados**, sem manipular o DOM à mão.

O modelo é: **UI = f(estado)**. Não dizes "muda este texto para X". Dizes "quando o estado é Y, a UI é assim". Quando o estado muda, o React recalcula e atualiza **só** o que mudou no DOM.

```jsx
const [done, setDone] = useState(false);
return <input type="checkbox" checked={done} onChange={() => setDone(!done)} />;
```

Não há `document.getElementById(...).checked = true`. O estado é a fonte de verdade.

## 2. Componentes e props

Um componente é uma **função que devolve JSX**. Recebe **props** (argumentos) e devolve elementos.

```jsx
export default function TaskList({ tasks, onToggle, onDelete }) { ... }
```

Regra de fluxo: **os dados descem por props, os eventos sobem por callbacks.** `TaskList` não sabe como apagar uma tarefa; recebe `onDelete` e chama-o. Quem sabe é `App`, que sabe da API.

Esta divisão torna os componentes **reutilizáveis e testáveis**:

| Componente | Estado próprio? | Sabe da API? |
|---|---|---|
| `App` | sim (tarefas, estatísticas, erro) | sim (via `api.js`) |
| `TaskForm` | sim (texto do input) | não |
| `TaskList` | não | não |
| `StatsBar` | não | não |

**Regra:** coloca o estado o **mais abaixo possível** que ainda sirva quem precisa dele. O texto do input só interessa ao formulário, por isso fica lá. A lista de tarefas interessa a `App`, porque também é usada depois de criar, apagar e atualizar.

## 3. `useState`: estado local

```jsx
const [title, setTitle] = useState('');
```

- `title` é o valor atual.
- `setTitle` pede uma atualização. **Não** muda `title` de imediato: o React agenda uma nova renderização.
- Mudar o estado **dispara** uma nova renderização do componente.

**Componente controlado:** em `TaskForm`, o `<input>` tem `value={title}` e `onChange`. O React é a fonte de verdade. Se não passares `value`, é um input **não controlado** e o estado vive no DOM, o que torna a limpeza do campo (`setTitle('')`) impossível de fazer pelo React.

## 4. `useEffect`: sincronizar com o exterior

Um efeito serve para **sincronizar** o React com algo **fora** dele: rede, timers, eventos do browser, o DOM.

```jsx
useEffect(() => {
  loadTasks().catch((err) => setError(err.message));
}, [loadTasks]);
```

- A função corre **depois** de renderizar.
- O **array de dependências** diz quando voltar a correr. `[]` = só uma vez ao montar. `[loadTasks]` = sempre que `loadTasks` mudar (aqui não muda, porque é um `useCallback` com array vazio).
- A função **devolvida** é a limpeza. Corre antes de o efeito voltar a correr e quando o componente desmonta.

Lê o efeito de polling em `App.jsx`:

```jsx
useEffect(() => {
  const loadStats = () => api.getStats().then(setStats).catch(() => {});
  loadStats();
  const timer = setInterval(loadStats, STATS_POLL_MS);
  return () => clearInterval(timer);   // sem isto, o timer continua a correr depois de o componente sair
}, []);
```

**Quando NÃO usar `useEffect`:** para calcular um valor a partir de outro estado. Isso faz-se no render: `const total = tasks.length;`. Usar efeito para isto cria renderizações extra e bugs.

## 5. O fluxo de uma ação: criar uma tarefa

1. O utilizador escreve e clica "Adicionar".
2. `TaskForm.handleSubmit` chama `event.preventDefault()` (senão o browser recarrega a página).
3. Chama `onCreate(trimmed)` → `App.handleCreate` → `run(...)`.
4. `run` chama `api.createTask`, depois `loadTasks` (que faz `setTasks`), e apanha erros para `setError`.
5. `setTasks` agenda a renderização. A lista atualiza-se.
6. De volta a `TaskForm`: `setTitle('')` limpa o campo.

**Pergunta:** repara que **não** atualizamos a lista localmente (adicionar ao array). Recarregamos do servidor. Porquê? Que bug evitamos? (Pista: o que acontece se a criação der erro, ou se outro utilizador tiver criado tarefas entretanto?)

<details>
<summary>Resposta</summary>

Recarregar do servidor garante que a UI mostra o estado **real**, incluindo o `id` gerado pela BD e o `created_at`. Atualizar localmente é uma **otimização** com risco: se o servidor rejeitar a operação, a UI fica a mentir até à próxima recarga. A otimização só vale a pena quando o custo do recarregamento é relevante, e aí faz-se *optimistic update* com reversão em caso de erro.
</details>

## 6. `api.js`: esconder a rede

Os componentes **não** fazem `fetch`. Chamam `api.createTask(title)`. Isto tem três vantagens:

- Mudar o URL base ou a forma de autenticação mexe num ficheiro só.
- A tradução de erros (`body.error`) está num sítio só.
- Podes trocar a implementação (ex.: mocks nos testes) sem tocar nos componentes.

## 7. Chaves em listas

```jsx
{tasks.map((task) => <li key={task.id} ...>)}
```

O `key` diz ao React **qual item é qual** entre renderizações. Com `key={index}`, ao apagar o primeiro item, o React pensa que o segundo "se tornou" o primeiro e reutiliza o DOM errado (por exemplo, o estado do checkbox fica no sítio errado). Usa sempre um id estável.

## 8. Polling vs tempo real

As estatísticas são pedidas de 3 em 3 segundos (*polling*). Alternativas:

| Técnica | Como | Quando |
|---|---|---|
| **Polling** | pedidos periódicos | simples, fiável, desperdiça pedidos se não houver mudanças |
| **SSE** (Server-Sent Events) | servidor empurra eventos por HTTP | atualizações do servidor para o cliente, unidirecional |
| **WebSocket** | canal bidirecional persistente | chat, jogos, colaboração em tempo real |

Para contadores que mudam de vez em quando, polling chega. Escolher WebSocket "porque é mais moderno" é um erro comum: traz estado de ligação, reconexão e balanceamento para resolver um problema que não tens.

## 9. Vite: o que faz por ti

- **Dev server** com *hot module replacement*: guardas um ficheiro e só esse módulo é recarregado.
- **Build** de produção: junta, minifica e gera *hashes* nos nomes (`index-Diva-lLB.js`). O hash muda quando o conteúdo muda, por isso o browser não usa uma versão antiga da cache.
- **Proxy** de desenvolvimento (`vite.config.js`): reencaminha `/api` para `localhost:3000`. Vê o módulo 10 para perceber porquê.

Experiência: corre `npm run dev` em `src/web` (com a API a correr no compose na porta 3000 — ou corre `docker compose ... up -d` e expõe temporariamente a API). Altera o título num componente e repara que a página atualiza sem recarregar.

## 10. StrictMode

`main.jsx` envolve a app em `<StrictMode>`. Em desenvolvimento, o React **monta, desmonta e volta a montar** cada componente, para expor efeitos sem limpeza. Vais ver os pedidos iniciais duplicados nos logs do browser. **É esperado.** Se o teu efeito estiver bem escrito, correr duas vezes não causa problemas.

---

## Prática: escreve tu

Os testes deste módulo usam o **Vitest** e o **Testing Library**, a combinação mais comum hoje para testar React. Correm os teus componentes num browser simulado (`jsdom`) e interagem com eles como um utilizador: escrevem em campos, carregam em botões, leem o que está no ecrã. **Não** olham para o estado interno. Se o ecrã estiver certo, o teste passa, seja qual for a forma como organizaste o código.

**Verificar:** `npm run verificar 08` (dentro de `pratica/`). Só um exercício: `npm run verificar 08 TaskFilter`, `... 08 EditableTitle` ou `... 08 useTasks`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Pesquisa e filtro: inputs controlados e estado derivado (≈30 min)

**Ficheiro:** `pratica/08-frontend-react/TaskFilter.jsx`

Um componente que recebe `tasks` e mostra um campo "Procurar", um `<select>` "Estado", a contagem "N de M tarefas" e a lista filtrada (ou uma mensagem, se não sobrar nenhuma). O enunciado completo está no comentário do ficheiro.

A pergunta central do exercício é: **o que é estado?** O texto do campo e a opção escolhida, sim. A lista filtrada, **não**: calcula-se a partir das props e do estado, a cada render. O último teste prova porquê: muda as `tasks` por fora e verifica que o filtro se aplica às novas. Se tiveres copiado as props para um `useState`, a lista fica congelada na versão antiga.

**Sintaxe que vais praticar:** `useState`, inputs controlados (`value` + `onChange`), `<select>` controlado, `{condição ? <A /> : <B />}`, `.map` com `key`, `<label>` à volta do campo (é isso que dá o "rótulo" que o teste procura).

<details>
<summary>Pista</summary>

Um objeto que associa cada valor do `<select>` a uma função de filtro (`{ todas: () => true, 'por-fazer': (t) => !t.done, ... }`) evita um `if`/`else` com três ramos. Depois, a lista visível é `tasks.filter(...).filter(...)`, escrita diretamente no corpo do componente.
</details>

<details>
<summary>Solução de referência</summary>

```jsx
import { useState } from 'react';

const STATUS_FILTERS = {
  todas: () => true,
  'por-fazer': (task) => !task.done,
  feitas: (task) => task.done,
};

export default function TaskFilter({ tasks }) {
  // Só o que o utilizador escreveu/escolheu é estado. A lista filtrada NÃO é estado:
  // calcula-se a cada render a partir das props e do estado (estado derivado).
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todas');

  const needle = query.trim().toLowerCase();
  const visible = tasks
    .filter(STATUS_FILTERS[status])
    .filter((task) => task.title.toLowerCase().includes(needle));

  return (
    <section>
      <label>
        Procurar <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>
        Estado{' '}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="por-fazer">Por fazer</option>
          <option value="feitas">Feitas</option>
        </select>
      </label>

      <p>
        {visible.length} de {tasks.length} tarefas
      </p>

      {visible.length === 0 ? (
        <p>Nenhuma tarefa corresponde ao filtro</p>
      ) : (
        <ul>
          {visible.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```
</details>

### P2 · Editar no sítio: eventos, refs e efeitos (≈35 min)

**Ficheiro:** `pratica/08-frontend-react/EditableTitle.jsx`

Um título com um botão "Editar". Ao clicar, aparece um campo **já com o foco**; Enter ou "Guardar" guarda, Escape cancela. Parece pequeno, mas junta quatro ideias diferentes:

- dois "modos" de apresentação a partir de um booleano;
- um **rascunho** separado do título verdadeiro (cancelar não pode estragar nada);
- dar foco a um elemento, que é mexer no DOM real, e por isso precisa de um `ref` e de um efeito;
- `preventDefault()` num `<form>`, para o browser não recarregar a página.

**Sintaxe que vais praticar:** `useRef`, `ref={...}`, `useEffect` com dependências, `onSubmit`, `onKeyDown` com `e.key`, `event.preventDefault()`, `return` antecipado de JSX.

<details>
<summary>Pista</summary>

Porque é que não podes chamar `inputRef.current.focus()` dentro do `onClick` do "Editar"? Porque nesse momento o `<input>` ainda não existe: o `setEditing(true)` só pede um novo render. Um `useEffect` com `[editing]` corre **depois** desse render, quando o `<input>` já está no DOM.
</details>

<details>
<summary>Solução de referência</summary>

```jsx
import { useEffect, useRef, useState } from 'react';

export default function EditableTitle({ title, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);

  // O foco é uma operação no DOM real, não algo que se descreve em JSX: é um efeito.
  // Corre depois do render em que `editing` passou a true, quando o <input> já existe.
  useEffect(() => {
    if (editing) inputRef.current.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft(title); // cada edição começa do título atual, não do rascunho abandonado
    setEditing(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault(); // sem isto, o browser submetia o formulário e recarregava a página
    const value = draft.trim();
    if (value && value !== title) onSave(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div>
        <span>{title}</span>{' '}
        <button type="button" onClick={startEditing}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Título{' '}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </label>
      <button type="submit">Guardar</button>
    </form>
  );
}
```
</details>

### P3 · Um hook próprio, com atualização otimista (≈45 min)

**Ficheiro:** `pratica/08-frontend-react/useTasks.js`

O `App.jsx` do projeto tem a lógica de carregar, criar e alterar tarefas misturada com o ecrã. Extrai-a para um **hook**: `useTasks(api)` devolve as tarefas, o estado de carregamento, o erro e as ações. O componente que o usar fica só com JSX.

A parte difícil é o `toggleTask` **otimista**: o ecrã muda logo, antes de a API responder, e se a API falhar a mudança é desfeita. É assim que as apps parecem rápidas mesmo com rede lenta. O teste segura a resposta da API "no ar" para confirmar que o ecrã já mudou antes dela chegar.

**Sintaxe que vais praticar:** hooks próprios (uma função `useAlgo` que usa outros hooks), `useEffect` com função de limpeza, `useCallback`, `setState` na forma funcional (`setTasks((prev) => ...)`), `.then().catch().finally()`.

<details>
<summary>Pista</summary>

- No efeito de carregamento, uma variável `let ignore = false` posta a `true` na limpeza evita escrever estado de um pedido antigo (se o componente desmontar antes de a resposta chegar).
- Usa sempre `setTasks((prev) => ...)` e não `setTasks(tasks.map(...))`: com ações em paralelo, `tasks` pode ser uma versão antiga da lista.
- Para o otimista: a função que muda o `done` é a mesma para aplicar e para desfazer, só muda o valor. Uma função que devolve outra função poupa repetição: `const flip = (done) => (prev) => prev.map(...)`.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { useCallback, useEffect, useState } from 'react';

export function useTasks(api) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Se o componente desmontar (ou a api mudar) antes de a resposta chegar, ignoramo-la:
    // escrever estado de um pedido "antigo" pode mostrar dados que já não são os certos.
    let ignore = false;
    setLoading(true);
    api
      .list()
      .then((list) => {
        if (!ignore) setTasks(list);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [api]);

  const addTask = useCallback(
    async (title) => {
      const task = await api.create(title);
      // Forma funcional (prev => ...): usa sempre a lista mais recente, mesmo com ações em paralelo.
      setTasks((prev) => [...prev, task]);
      setError(null);
    },
    [api],
  );

  const toggleTask = useCallback(
    async (task) => {
      const flip = (done) => (prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t));
      setTasks(flip(!task.done)); // 1) o ecrã muda já
      try {
        await api.setDone(task.id, !task.done); // 2) a API confirma depois
        setError(null);
      } catch (err) {
        setTasks(flip(task.done)); // 3) se falhou, desfaz
        setError(err.message);
      }
    },
    [api],
  );

  const removeTask = useCallback(
    async (id) => {
      await api.remove(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setError(null);
    },
    [api],
  );

  return { tasks, loading, error, addTask, toggleTask, removeTask };
}
```

Repara no `[api]` das dependências. Se um componente fizer `useTasks({ list: ..., create: ... })` com um objeto escrito ali, cada render cria um objeto **novo**, o efeito volta a correr, carrega, muda o estado, provoca outro render... um ciclo infinito de pedidos. É por isso que o teste cria a `api` fora do `renderHook`, e que o `api.js` do projeto é um objeto definido uma vez, fora dos componentes.
</details>

## Experiências

1. **Estado vs DOM:** no `TaskForm`, remove o `value={title}` (mantém o `onChange`). Escreve algo e clica "Adicionar". O campo limpa? Porquê?
2. **Limpeza:** remove o `return () => clearInterval(timer)` do efeito de polling. Muda para `F5` e navega entre páginas... (ou simplesmente observa com StrictMode: vê dois timers a correr no `console`). Porque é que isto é um vazamento de memória em apps com navegação?
3. **Key:** muda `key={task.id}` para `key={index}` no `TaskList` e apaga o primeiro item com o checkbox marcado. O que acontece visualmente? Porquê?

## Perguntas de pensamento crítico

1. O `App` tem `run` com `useCallback`. Porque é que `loadTasks` precisa de `useCallback` mas `handleCreate` não? (Pista: o que é que `useEffect` usa como dependência.)
2. Se a API demorar 10 segundos a responder ao `POST`, o que vê o utilizador? Como melhorarias a experiência **sem** mudar a API?
3. Porque é que os erros de `loadStats` são engolidos (`.catch(() => {})`) mas os de `run` são mostrados? Quando é que esta decisão estaria errada?

<details>
<summary>Resposta</summary>

1. `loadTasks` é usado dentro de `run` e de um `useEffect`. Sem `useCallback`, teria nova identidade em cada renderização, e o efeito (que o tem nas dependências) correria em cada renderização: um ciclo. `handleCreate` não é dependência de nenhum efeito, por isso não precisa de memorização. Memorizar tudo é ruído; memoriza-se o que é dependência de efeitos ou filho de componentes memorizados.
2. Sem feedback, o botão não reage e o utilizador clica várias vezes (criando duplicados). Melhorias: desativar o botão enquanto `pending`, mostrar um estado de carregamento, e no `TaskForm` impedir submissão dupla. Não se muda a API para isto.
3. Estatísticas são informação secundária: se falharem, o último valor válido continua no ecrã, e mostrar um erro a cada 3 segundos seria pior do que nada. Um erro de uma ação é **resposta direta** a algo que o utilizador fez, e deve ser visível. Estaria errado se as estatísticas fossem críticas (ex.: saldo bancário), onde um valor antigo mostrado como atual é perigoso.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 08`.

**1.** Porque é que o <input> do TaskForm tem value={title} e onChange em vez de ser 'não controlado'?

- a) Só por estilo de código
- b) Torna-o CONTROLADO: o React é a fonte de verdade do valor, o que permite limpar o campo via estado (setTitle(''))
- c) É uma exigência do HTML5
- d) Melhora a performance de renderização

<details><summary>Resposta</summary>

**b) Torna-o CONTROLADO: o React é a fonte de verdade do valor, o que permite limpar o campo via estado (setTitle(''))** — Sem value, o estado do input viveria no DOM, fora do controlo do React.

</details>

**2.** Para que serve a função devolvida por um useEffect?

- a) Não serve para nada em particular
- b) É a função de LIMPEZA: corre antes do efeito repetir e quando o componente desmonta
- c) Formata o JSX antes de renderizar
- d) Substitui por completo o useState

<details><summary>Resposta</summary>

**b) É a função de LIMPEZA: corre antes do efeito repetir e quando o componente desmonta** — Sem ela, por exemplo, um setInterval continuaria a correr depois de o componente desaparecer.

</details>

**3.** Porque é que usar o ÍNDICE do array como 'key' numa lista pode causar bugs?

- a) Nunca causa bugs, é seguro sempre
- b) O React pode associar o estado errado a cada item quando a lista muda de tamanho (ex.: ao apagar o primeiro)
- c) É proibido pelo React e dá erro de compilação
- d) Torna a lista visivelmente mais lenta

<details><summary>Resposta</summary>

**b) O React pode associar o estado errado a cada item quando a lista muda de tamanho (ex.: ao apagar o primeiro)** — Usa sempre um id estável (task.id), nunca a posição no array.

</details>

**4.** Porque recarregar as tarefas do SERVIDOR depois de criar uma, em vez de a adicionar localmente ao array?

- a) Por preguiça de escrever mais código
- b) Garante que a UI reflete o estado real do servidor (id, created_at), mesmo que a criação seja rejeitada ou outro dado tenha mudado
- c) É sempre mais rápido
- d) É uma exigência do React

<details><summary>Resposta</summary>

**b) Garante que a UI reflete o estado real do servidor (id, created_at), mesmo que a criação seja rejeitada ou outro dado tenha mudado** — É a troca entre simplicidade/correção e a otimização de um 'optimistic update'.

</details>

**5.** Quando é que o polling (perguntar a cada X segundos) é preferível a WebSocket?

- a) Nunca, WebSocket é sempre melhor
- b) Quando os dados mudam pouco e alguns segundos de atraso são aceitáveis: menos complexidade do que gerir ligações WebSocket
- c) Sempre que há mais de um utilizador ligado
- d) Só quando a app corre em produção

<details><summary>Resposta</summary>

**b) Quando os dados mudam pouco e alguns segundos de atraso são aceitáveis: menos complexidade do que gerir ligações WebSocket** — WebSocket traz estado de ligação, reconexão e balanceamento — custo que só compensa com necessidade real de tempo real.

</details>

<!-- quiz:end -->
