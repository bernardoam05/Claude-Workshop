// P3 · Controlo de acesso partido (OWASP A01, o PRIMEIRO da lista): IDOR e mass assignment.
//
// A autenticação já está feita (simplificada): o cabeçalho X-Utilizador diz quem está a pedir.
// O problema é a AUTORIZAÇÃO. Corrige:
//   - GET /notas/:id de uma nota que não é tua → 404 (não 403: porquê?)
//   - PATCH /notas/:id de uma nota que não é tua → 404
//   - PATCH só pode alterar "titulo" e "texto". Qualquer outro campo do corpo (dono, id, ...)
//     é IGNORADO (não dá erro, simplesmente não é aplicado).
import express from 'express';

export function criarApp(notas) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.utilizador = req.get('X-Utilizador');
    if (!req.utilizador) return res.status(401).json({ error: 'não autenticado' });
    next();
  });

  app.get('/notas', (req, res) => {
    res.json(notas.filter((n) => n.dono === req.utilizador));
  });

  app.get('/notas/:id', (req, res) => {
    const nota = notas.find((n) => n.id === Number(req.params.id));
    if (!nota) return res.status(404).json({ error: 'não encontrada' });
    res.json(nota);
  });

  app.patch('/notas/:id', (req, res) => {
    const nota = notas.find((n) => n.id === Number(req.params.id));
    if (!nota) return res.status(404).json({ error: 'não encontrada' });
    Object.assign(nota, req.body);
    res.json(nota);
  });

  return app;
}
