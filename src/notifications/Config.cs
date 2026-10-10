using Microsoft.EntityFrameworkCore;
using Notifications.Data;
using Npgsql;

namespace Notifications;

// Mesma filosofia dos outros serviços (config.js, application.yml): variáveis de ambiente
// validadas no arranque. Se faltar alguma, o processo falha já, com uma mensagem clara.
public static class Config
{
    public static string DatabaseUrl => Required("DATABASE_URL");
    public static string RabbitMqUrl => Required("RABBITMQ_URL");
    public static string OidcIssuer => Required("OIDC_ISSUER");
    public static string OidcJwksUrl => Required("OIDC_JWKS_URL");
    public static string OidcAudience => Required("OIDC_AUDIENCE");

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"Variável de ambiente obrigatória em falta: {name}");

    // Os outros serviços usam uma única URL "postgres://user:pass@host:port/db" (como o Node e o
    // JDBC do Spring). O Npgsql quer os campos separados — converte-se aqui, uma vez só.
    // Sem SearchPath: deixamos o Postgres no "public" por omissão. HasDefaultSchema (no DbContext)
    // já qualifica todas as tabelas com "notifications."; apontar o search_path para um schema
    // que ainda não existe fazia a PRÓPRIA criação do schema falhar ("no schema selected to create in").
    public static string BuildNpgsqlConnectionString(string databaseUrl)
    {
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);
        return new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port == -1 ? 5432 : uri.Port,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = userInfo[0],
            Password = userInfo.Length > 1 ? userInfo[1] : "",
        }.ConnectionString;
    }

    // "notifications" é o SCHEMA próprio deste serviço, tal como o "activity" do Spring: cada
    // serviço é dono dos seus dados, mesmo partilhando o mesmo servidor Postgres neste workshop.
    // Centralizado aqui porque é preciso em 3 sítios (Program.cs, a factory de design-time, e os
    // testes de integração) e tem de ser sempre igual: até a tabela de histórico de migrações do
    // EF Core precisa de saber o schema, senão tenta criar-se antes de "notifications" existir.
    // DbContextOptionsBuilder (não o genérico): AddDbContext dá-nos a versão base, e
    // DbContextOptionsBuilder&lt;T&gt; já é um DbContextOptionsBuilder, por isso serve nos dois sítios.
    public static void ConfigureNpgsql(DbContextOptionsBuilder builder, string databaseUrl) =>
        builder.UseNpgsql(
            BuildNpgsqlConnectionString(databaseUrl),
            o => o.MigrationsHistoryTable("__EFMigrationsHistory", "notifications"));

    // Keycloak serve o documento de descoberta OIDC ("iss"/jwks_uri/...) neste caminho padrão.
    // Reaproveitamos a mesma OIDC_JWKS_URL que os outros serviços já recebem, em vez de uma
    // variável de ambiente nova só para isto.
    public static string OidcMetadataAddress =>
        OidcJwksUrl.Replace("/protocol/openid-connect/certs", "/.well-known/openid-configuration");
}
