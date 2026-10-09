package pt.workshop.activity.config;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

// Spring Security como "resource server": valida o JWT do Keycloak em cada pedido.
// A validação (assinatura via JWKS, issuer, audience, expiração) é configurada em application.yml.
// Aqui só dizemos QUE rotas são públicas e COMO ler os papéis do token.
@Configuration
@EnableMethodSecurity // ativa @PreAuthorize nos controllers
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                // API sem cookies de sessão (só tokens Bearer): o ataque CSRF não se aplica.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Health e métricas: públicos DENTRO da rede Docker. O Nginx não encaminha /actuator.
                        .requestMatchers("/actuator/health/**", "/actuator/prometheus").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakConverter())))
                .build();
    }

    // O Keycloak põe os papéis do realm em: { "realm_access": { "roles": ["admin", ...] } }.
    // O Spring, por omissão, só lê o claim "scope". Este conversor traduz cada papel em "ROLE_<papel>",
    // que é o formato que hasRole('admin') espera.
    @Bean
    JwtAuthenticationConverter keycloakConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoles());
        converter.setPrincipalClaimName("preferred_username");
        return converter;
    }

    static class KeycloakRealmRoles implements Converter<Jwt, Collection<GrantedAuthority>> {
        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null || !(realmAccess.get("roles") instanceof List<?> roles)) {
                return List.of();
            }
            return roles.stream()
                    .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                    .toList();
        }
    }
}
