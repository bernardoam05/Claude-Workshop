using System.Security.Claims;
using Notifications.Auth;

namespace Notifications.Tests;

// Este é o ponto onde mais se erra numa integração com Keycloak: se não se ler o claim certo,
// TODOS os pedidos dão 403 e ninguém percebe porquê. O mesmo teste existe em Java
// (KeycloakRealmRolesTest) — é a mesma armadilha, agora em C#.
public class KeycloakRoleClaimsTests
{
    [Fact]
    public void ConverteRealmAccessEmClaimsDeRole()
    {
        var identity = new ClaimsIdentity();

        KeycloakRoleClaims.AddRealmRoles(identity, """{"roles":["admin","user"]}""");

        var roles = identity.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value);
        Assert.Equal(["admin", "user"], roles.OrderBy(r => r));
    }

    [Fact]
    public void SemRealmAccessNaoTemPapeis()
    {
        var identity = new ClaimsIdentity();

        KeycloakRoleClaims.AddRealmRoles(identity, null);

        Assert.Empty(identity.Claims);
    }

    [Fact]
    public void RealmAccessSemRolesNaoRebenta()
    {
        var identity = new ClaimsIdentity();

        KeycloakRoleClaims.AddRealmRoles(identity, """{"outraCoisa":true}""");

        Assert.Empty(identity.Claims);
    }
}
