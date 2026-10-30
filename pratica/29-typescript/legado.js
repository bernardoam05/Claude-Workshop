// O código antigo (JavaScript, sem tipos), que o P4 te pede para migrar para migrado.ts.
// Lê-o: tem dois bugs que o TypeScript, com os tipos certos, teria apanhado. Consegues encontrá-los?

export function lerTarefas(json) {
  return JSON.parse(json).map((t) => ({ id: t.id, titulo: t.title, feita: t.done, etiquetas: t.tags }));
}

export function resumir(tarefas) {
  const porEtiqueta = {};
  for (const t of tarefas) {
    for (const e of t.etiqueta) porEtiqueta[e] = (porEtiqueta[e] || 0) + 1;
  }
  return { total: tarefas.length, feitas: tarefas.filter((t) => t.feita).lenght, porEtiqueta };
}
