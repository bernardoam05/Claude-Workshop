using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Notifications.Data;

// Usado SÓ por "dotnet ef migrations add/update" em tempo de design (nunca em produção).
// As ferramentas EF precisam de construir o DbContext sem passar pelo "Program.cs" inteiro
// (sem RabbitMQ, sem autenticação). "dotnet ef migrations add" nem chega a abrir a ligação —
// só usa isto para conhecer o modelo; por isso um valor por omissão aqui é inofensivo.
public class NotificationsDbContextFactory : IDesignTimeDbContextFactory<NotificationsDbContext>
{
    public NotificationsDbContext CreateDbContext(string[] args)
    {
        var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? "postgres://design:design@localhost:5432/design";
        var builder = new DbContextOptionsBuilder<NotificationsDbContext>();
        Config.ConfigureNpgsql(builder, databaseUrl);
        return new NotificationsDbContext(builder.Options);
    }
}
