// P1 · Como um topic exchange decide para onde vai cada mensagem.
//
// matches(bindingKey, routingKey) → true se a mensagem com esta routing key chega a uma fila
// ligada com esta binding key. As chaves são palavras separadas por pontos ("task.created").
// Na binding key:
//   *  substitui EXATAMENTE uma palavra     ("task.*" apanha "task.created", não "task.a.b")
//   #  substitui ZERO ou mais palavras       ("task.#" apanha "task", "task.created", "task.a.b")
//
// route(bindings, routingKey) recebe uma lista [{ queue, bindingKey }] e devolve os nomes das
// filas que recebem a mensagem, sem repetidos, pela ordem em que aparecem em `bindings`.
export function matches(bindingKey, routingKey) {
  throw new Error('Por fazer: P1');
}

export function route(bindings, routingKey) {
  throw new Error('Por fazer: P1');
}
