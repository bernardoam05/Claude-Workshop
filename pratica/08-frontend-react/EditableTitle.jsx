// P2 · Um título que se edita no sítio (eventos, refs e dois modos de apresentação).
//
// Props: title (string) e onSave(novoTitulo).
// Modo leitura: mostra o título e um botão "Editar".
// Modo edição (depois de clicar "Editar"):
//   - um campo de texto com o rótulo "Título", preenchido com o título atual e JÁ com o foco
//   - um botão "Guardar"; Enter no campo também guarda (é um <form>)
//   - Escape cancela: volta ao modo leitura sem guardar
//   - guardar chama onSave com o texto sem espaços nas pontas e volta ao modo leitura;
//     se o texto ficou vazio ou igual ao título, não chama onSave (mas volta ao modo leitura na mesma)
//
// Ver docs/08-frontend-react.md, secção "Prática".
export default function EditableTitle({ title, onSave }) {
  throw new Error('Por fazer: P2');
}
