// Contrato do evento, tal como a API o publica. Os tipos são um CONTRATO entre dois serviços.
// Atenção: o TypeScript só existe em compilação. Um JSON que chega da fila pode ter qualquer forma,
// por isso a validação em runtime (isTaskEvent) continua a ser obrigatória.
export interface TaskSnapshot {
  id: number;
  title: string;
  done: boolean;
  userId: number;
}

export interface TaskEvent {
  eventId: string;
  type: 'task.created' | 'task.completed';
  occurredAt: string;
  task: TaskSnapshot;
}

export type HandleResult = 'processado' | 'duplicado (ignorado)';

// Erro "permanente": reenviar a mesma mensagem nunca a torna válida.
// Essas mensagens vão para a Dead Letter Queue em vez de ficarem a circular para sempre.
export class MalformedEventError extends Error {}

// Só o que o handler usa de uma BD. Facilita os testes: basta uma função falsa.
export interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

// Converte o corpo bruto da mensagem (Buffer) em dados. Ainda não sabemos se têm a forma certa.
export function parseJson(buffer: Buffer): unknown {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new MalformedEventError('JSON inválido');
  }
}

// Type guard: verifica em runtime a forma do evento. Depois desta função, o compilador
// já pode tratar o valor como TaskEvent.
export function isTaskEvent(value: unknown): value is TaskEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  const task = e.task as Record<string, unknown> | undefined;
  return (
    typeof e.eventId === 'string' &&
    (e.type === 'task.created' || e.type === 'task.completed') &&
    typeof task === 'object' &&
    task !== null &&
    typeof task.id === 'number'
  );
}

// Fábrica do handler. Recebe a BD como dependência, por isso é testável sem RabbitMQ.
export function createEventHandler({ db }: { db: Queryable }) {
  return async function handle(value: unknown): Promise<HandleResult> {
    if (!isTaskEvent(value)) {
      throw new MalformedEventError('campos obrigatórios em falta ou com tipo errado');
    }
    const event = value; // a partir daqui, o compilador sabe a forma do evento

    // IDEMPOTÊNCIA: o RabbitMQ entrega "pelo menos uma vez". Se a mesma mensagem chegar outra vez,
    // o ON CONFLICT impede a inserção e o RETURNING não devolve linhas. O efeito acontece uma vez.
    const { rows } = await db.query(
      `INSERT INTO task_events (event_id, type, task_id, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.eventId, event.type, event.task.id, JSON.stringify(event)],
    );

    return rows.length === 0 ? 'duplicado (ignorado)' : 'processado';
  };
}
