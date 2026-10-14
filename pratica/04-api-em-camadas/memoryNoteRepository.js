// Já feito: um repositório em memória, com o mesmo contrato que teria a versão com Postgres.
// A camada de serviço não sabe (nem quer saber) qual das duas recebe.
export function createMemoryNoteRepository() {
  const notes = new Map();
  let nextId = 1;
  // Devolvemos sempre cópias, como faria uma BD: quem chama não consegue alterar o que está guardado.
  const copy = (note) => (note ? structuredClone(note) : null);

  return {
    async findAllByUser(userId) {
      return [...notes.values()].filter((n) => n.userId === userId).map(copy);
    },
    async findById(id) {
      return copy(notes.get(id));
    },
    async insert(note) {
      const saved = { ...note, id: nextId++ };
      notes.set(saved.id, saved);
      return copy(saved);
    },
    async update(id, fields) {
      if (!notes.has(id)) return null;
      notes.set(id, { ...notes.get(id), ...fields });
      return copy(notes.get(id));
    },
    async delete(id) {
      return notes.delete(id);
    },
  };
}
