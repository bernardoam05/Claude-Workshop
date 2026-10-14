// P1 · Validação na fronteira com zod (como src/api/src/validation/taskSchemas.js).
// Ver as regras completas em docs/04-api-em-camadas.md, secção "Prática".
//
// Exporta três esquemas:
//   createNoteSchema  → corpo do POST /notes
//   updateNoteSchema  → corpo do PATCH /notes/:id
//   listQuerySchema   → query string do GET /notes (?tag=...&pinned=...&limit=...)
