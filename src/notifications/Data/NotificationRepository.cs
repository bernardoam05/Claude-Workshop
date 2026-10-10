using Microsoft.EntityFrameworkCore;
using Notifications.Events;

namespace Notifications.Data;

public static class NotificationRepository
{
    // Idempotente: ON CONFLICT DO NOTHING — o mesmo truque do worker (Node) e do
    // ActivityEventRepository (Spring). A BD decide atomicamente se o evento já existia.
    // Devolve true se inseriu agora (primeira vez), false se já existia (reentrega).
    public static async Task<bool> InsertIfAbsentAsync(NotificationsDbContext db, TaskEvent evt)
    {
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO notifications.notifications (event_id, type, task_id, user_id, title, occurred_at)
            VALUES ({Guid.Parse(evt.EventId!)}, {evt.Type}, {evt.Task!.Id}, {evt.Task.UserId}, {evt.Task.Title}, {evt.OccurredAt})
            ON CONFLICT (event_id) DO NOTHING
            """);
        return inserted > 0;
    }
}
