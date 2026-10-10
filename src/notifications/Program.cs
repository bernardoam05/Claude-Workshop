using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Notifications;
using Notifications.Auth;
using Notifications.Data;
using Notifications.Messaging;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<NotificationsDbContext>(options =>
    Config.ConfigureNpgsql(options, Config.DatabaseUrl));

builder.Services.AddHostedService<RabbitMqConsumer>();

// Resource server OIDC: o mesmo que a API Node (oidcVerifier.js) e o Spring (SecurityConfig.java)
// fazem, com a biblioteca própria do .NET. Dois URLs, de propósito (ver módulo 14): o "Authority"
// usa o endpoint INTERNO (o único que este contentor alcança); o "ValidIssuer" é o público, porque
// é esse que aparece no "iss" do token (o browser falou com o Keycloak pelo nome público).
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MetadataAddress = Config.OidcMetadataAddress;
        options.RequireHttpsMetadata = false; // só desenvolvimento: dentro da rede Docker, sem TLS
        options.TokenValidationParameters.ValidIssuer = Config.OidcIssuer;
        options.TokenValidationParameters.ValidAudience = Config.OidcAudience;

        // O Keycloak põe os papéis em "realm_access": {"roles": [...]}. O JwtBearer, por omissão,
        // não sabe ler isto como papéis — é o MESMO problema que apareceu no Spring (módulo 17),
        // numa terceira linguagem. Sem este mapeamento, RequireRole("admin") falharia sempre.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var realmAccessJson = context.Principal?.FindFirst("realm_access")?.Value;
                var identity = (ClaimsIdentity)context.Principal!.Identity!;
                KeycloakRoleClaims.AddRealmRoles(identity, realmAccessJson);
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization(options =>
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("admin")));

var app = builder.Build();

// Aplica as migrações EF Core no arranque — o mesmo padrão do migrate.js (Node) e do Flyway (Spring).
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<NotificationsDbContext>().Database.Migrate();
}

app.UseAuthentication();
app.UseAuthorization();

// Público: readiness do Docker. Fora de /api, tal como os outros (/api/health, /actuator/health).
app.MapGet("/health", async (NotificationsDbContext db) =>
{
    try
    {
        await db.Database.ExecuteSqlRawAsync("SELECT 1");
        return Results.Ok(new { status = "ok" });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "degraded", reason = ex.Message }, statusCode: 503);
    }
});

app.MapGet("/api/notifications/summary", async (NotificationsDbContext db) =>
{
    var total = await db.Notifications.CountAsync();
    var byType = await db.Notifications
        .GroupBy(n => n.Type)
        .Select(g => new { type = g.Key, total = g.Count() })
        .ToListAsync();
    return Results.Ok(new { totalNotifications = total, byType });
}).RequireAuthorization("AdminOnly");

app.MapGet("/api/notifications/recent", async (NotificationsDbContext db) =>
{
    var items = await db.Notifications
        .OrderByDescending(n => n.ReceivedAt)
        .Take(20)
        .ToListAsync();
    return Results.Ok(items);
}).RequireAuthorization("AdminOnly");

app.Run();

// Expõe a classe Program ao WebApplicationFactory<Program> dos testes de integração.
public partial class Program;
