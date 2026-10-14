// P2 · Um botão com variantes, tamanhos e estados (ver docs/09-estilos-css.md, secção "Prática").
// Isto já funciona, mas não tem estilo nenhum nem variantes. O teu trabalho é dar-lhos.
export default function Button({ children, ...props }) {
  return <button {...props}>{children}</button>;
}
