using System.Security.Claims;
using System.Text.Json;

namespace Notifications.Auth;

// O Keycloak põe os papéis do realm em "realm_access": {"roles": [...]}. O JwtBearer do .NET,
// por omissão, não os lê como papéis — o MESMO problema que apareceu no Spring (módulo 17),
// agora numa terceira linguagem. Sem isto, qualquer RequireRole("admin") falha sempre com 403.
// Extraído para fora do Program.cs só para ser testável sem subir um servidor.
public static class KeycloakRoleClaims
{
    public static void AddRealmRoles(ClaimsIdentity identity, string? realmAccessJson)
    {
        if (realmAccessJson is null) return;

        using var doc = JsonDocument.Parse(realmAccessJson);
        if (!doc.RootElement.TryGetProperty("roles", out var roles)) return;

        foreach (var role in roles.EnumerateArray())
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, role.GetString() ?? ""));
        }
    }
}
