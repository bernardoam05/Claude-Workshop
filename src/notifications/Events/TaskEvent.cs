namespace Notifications.Events;

// O contrato do evento, tal como a API Node o publica. "records" são imutáveis, como o
// TaskEvent.java (Spring) — o mesmo conceito em três linguagens diferentes.
public record TaskSnapshot(long? Id, string? Title, bool? Done, long? UserId);

public record TaskEvent(string? EventId, string? Type, DateTimeOffset? OccurredAt, TaskSnapshot? Task);

// Erro PERMANENTE: repetir não resolve. Vai para a Dead Letter Queue sem novas tentativas.
// O mesmo papel do MalformedEventError (worker, Node) e do MalformedEventException (Spring).
public class MalformedEventException(string message) : Exception(message);
