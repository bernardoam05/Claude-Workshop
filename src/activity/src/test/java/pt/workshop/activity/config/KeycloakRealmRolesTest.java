package pt.workshop.activity.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

// O conversor é o sítio onde mais se erra numa integração com Keycloak: se ler o claim errado,
// TODOS os pedidos dão 403 e ninguém percebe porquê. Por isso tem um teste próprio.
class KeycloakRealmRolesTest {

    private final SecurityConfig.KeycloakRealmRoles converter = new SecurityConfig.KeycloakRealmRoles();

    @Test
    void converteRealmRolesEmRoleAuthorities() {
        Jwt jwt = token(Map.of("realm_access", Map.of("roles", List.of("admin", "user"))));

        List<String> authorities = converter.convert(jwt).stream().map(GrantedAuthority::getAuthority).toList();

        assertThat(authorities).containsExactlyInAnyOrder("ROLE_admin", "ROLE_user");
    }

    @Test
    void tokenSemRealmAccessNaoTemPapeis() {
        assertThat(converter.convert(token(Map.of("sub", "x")))).isEmpty();
    }

    private static Jwt token(Map<String, Object> claims) {
        return Jwt.withTokenValue("t").header("alg", "RS256").claims(c -> c.putAll(claims))
                .claim("sub", "u").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }
}
