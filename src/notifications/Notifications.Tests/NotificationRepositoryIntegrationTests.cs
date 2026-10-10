using Microsoft.EntityFrameworkCore;
using Notifications.Data;
using Notifications.Events;

namespace Notifications.Tests;

// Teste de INTEGRAÇÃO: corre contra um Postgres real. É o equivalente ao
// repositories.integration.test.js (Node) e ao que o Testcontainers faria no Spring (módulo 17,
// exercício D9) — aqui feito mais simples, contra a BD do compose, com a mesma guarda de
// segurança: recusa correr numa base cujo nome não contenha "test".
public class NotificationRepositoryIntegrationTests : IAsyncLifetime
{
    private readonly string _databaseUrl;
    private NotificationsDbContext _db = null!;

    public NotificationRepositoryIntegrationTests()
    {
        _databaseUrl = Environment.GetEnvironmentVariable("DATABASE_TEST_URL")
            ?? throw new InvalidOperationException("Define DATABASE_TEST_URL (ver docs/10-testes-e-observabilidade.md)");

        var dbName = new Uri(_databaseUrl).AbsolutePath.TrimStart('/');
        if (!dbName.Contains("test"))
        {
            throw new InvalidOperationException($"Recusado: a base \"{dbName}\" não parece ser de teste.");
        }
    }

    public async Task InitializeAsync()
    {
        var optionsBuilder = new DbContextOptionsBuilder<NotificationsDbContext>();
        Notifications.Config.ConfigureNpgsql(optionsBuilder, _databaseUrl);
        _db = new NotificationsDbContext(optionsBuilder.Options);
        await _db.Database.MigrateAsync();
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE notifications.notifications");
    }

    public async Task DisposeAsync() => await _db.DisposeAsync();

    private static TaskEvent MakeEvent(string eventId, string type = "task.completed") =>
        new(eventId, type, DateTimeOffset.UtcNow, new TaskSnapshot(7, "Estudar .NET", true, 3));

    [Fact]
    public async Task PrimeiraEntregaInsereESegundaEIgnorada()
    {
        var evt = MakeEvent("11111111-1111-4111-8111-111111111111");

        var first = await NotificationRepository.InsertIfAbsentAsync(_db, evt);
        var second = await NotificationRepository.InsertIfAbsentAsync(_db, evt); // reentrega

        Assert.True(first);
        Assert.False(second);
        Assert.Equal(1, await _db.Notifications.CountAsync());
    }

    [Fact]
    public async Task MigracaoCriaOSchemaETabelaNotifications()
    {
        var evt = MakeEvent("22222222-2222-4222-8222-222222222222");
        await NotificationRepository.InsertIfAbsentAsync(_db, evt);

        var saved = await _db.Notifications.SingleAsync();
        Assert.Equal(3, saved.UserId);
        Assert.Equal("Estudar .NET", saved.Title);
    }
}
