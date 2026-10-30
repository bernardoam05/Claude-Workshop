// Ferramentas para testar TIPOS (já feito). Correm no compilador, não em tempo de execução:
//   esperar<Igual<A, B>>()  não compila se A e B não forem exatamente o mesmo tipo.
export type Igual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export function esperar<_T extends true>(): void {}
