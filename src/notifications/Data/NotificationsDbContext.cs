using Microsoft.EntityFrameworkCore;

namespace Notifications.Data;

// O equivalente EF Core do ActivityEventRepository (Spring/JPA) e do taskRepository.js (SQL à mão).
// Mapear à mão (ToTable/HasColumnName) em vez de confiar nas convenções do EF Core: os nomes das
// colunas em Postgres são snake_case (event_id), as propriedades C# são PascalCase (EventId).
public class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options) : DbContext(options)
{
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // O Npgsql gera "CREATE SCHEMA IF NOT EXISTS" para o schema por omissão, na própria
        // migração — sem isto, "CREATE TABLE notifications (...)" falhava, porque o SearchPath
        // da ligação aponta para um schema que ainda não existe.
        modelBuilder.HasDefaultSchema("notifications");

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("notifications");
            e.HasKey(n => n.EventId);
            e.Property(n => n.EventId).HasColumnName("event_id");
            e.Property(n => n.Type).HasColumnName("type");
            e.Property(n => n.TaskId).HasColumnName("task_id");
            e.Property(n => n.UserId).HasColumnName("user_id");
            e.Property(n => n.Title).HasColumnName("title");
            e.Property(n => n.OccurredAt).HasColumnName("occurred_at");
            // DEFAULT now() na própria BD: o INSERT em SQL puro (NotificationRepository) não passa
            // por este valor por omissão do C#, só um default ao nível do Postgres o garante
            // sempre — o mesmo padrão de task_events (Node) e activity_events (Spring).
            e.Property(n => n.ReceivedAt).HasColumnName("received_at").HasDefaultValueSql("now()");
        });
    }
}
