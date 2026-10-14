// Já feito: um erro "permanente". Repetir a mesma mensagem nunca a torna válida (ex.: falta um campo),
// por isso não vale a pena tentar outra vez: vai direta para a DLQ.
export class PermanentError extends Error {}
