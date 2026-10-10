namespace Notifications.Data;

// Entidade EF Core. Equivalente ao ActivityEvent.java (Spring) e à tabela task_events (Node).
// EventId é a CHAVE DE IDEMPOTÊNCIA: o mesmo evento nunca entra duas vezes (ver RabbitMqConsumer).
public class Notification
{
    public Guid EventId { get; set; }
    public string Type { get; set; } = "";
    public long TaskId { get; set; }
    public long UserId { get; set; }
    public string? Title { get; set; }
    public DateTimeOffset? OccurredAt { get; set; }
    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;
}
