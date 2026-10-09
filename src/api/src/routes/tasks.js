import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { createTaskSchema, idParamSchema, updateTaskSchema } from '../validation/taskSchemas.js';

// Camada HTTP: traduz pedidos em chamadas ao serviço e respostas em códigos HTTP.
// Não contém regras de negócio nem SQL. Todas estas rotas exigem autenticação.
export function createTasksRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);

  // req.user.userId foi preenchido pelo middleware de autenticação.
  router.get('/tasks', async (req, res) => {
    const { tasks, source } = await service.listTasks(req.user.userId);
    // Cabeçalho de diagnóstico: permite ver no browser/curl se a resposta veio da cache.
    res.set('X-Cache', source === 'cache' ? 'HIT' : 'MISS');
    res.json(tasks);
  });

  router.post('/tasks', async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const task = await service.createTask(req.user.userId, parsed.data.title);
    res.status(201).json(task);
  });

  router.patch('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'O campo "done" tem de ser booleano');

    const task = await service.updateTask(req.user.userId, id, parsed.data.done);
    if (!task) throw new HttpError(404, 'Tarefa não encontrada');
    res.json(task);
  });

  router.delete('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const removed = await service.deleteTask(req.user.userId, id);
    if (!removed) throw new HttpError(404, 'Tarefa não encontrada');
    res.status(204).end();
  });

  router.get('/stats', async (req, res) => {
    res.json(await service.getStats(req.user.userId));
  });

  return router;
}

function parseId(raw) {
  const parsed = idParamSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'ID inválido');
  return parsed.data;
}
