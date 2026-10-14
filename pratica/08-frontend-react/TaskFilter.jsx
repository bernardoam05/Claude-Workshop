// P1 · Uma lista de tarefas com pesquisa e filtro por estado (inputs controlados + estado derivado).
//
// Recebe a prop `tasks` (array de { id, title, done }) e mostra:
//   - um campo de texto com o rótulo "Procurar" (filtra pelo título, sem distinguir maiúsculas)
//   - um <select> com o rótulo "Estado" e as opções (value → texto):
//       'todas' → Todas · 'por-fazer' → Por fazer · 'feitas' → Feitas
//   - um parágrafo "N de M tarefas" (N = visíveis, M = total)
//   - a lista (<ul> com um <li> por tarefa visível, com o título), ou, se nenhuma corresponder,
//     o parágrafo "Nenhuma tarefa corresponde ao filtro" (e nenhuma lista)
//
// Ver docs/08-frontend-react.md, secção "Prática".
export default function TaskFilter({ tasks }) {
  throw new Error('Por fazer: P1');
}
