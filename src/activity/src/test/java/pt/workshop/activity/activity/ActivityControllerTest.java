package pt.workshop.activity.activity;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pt.workshop.activity.config.SecurityConfig;

// Teste de "fatia" (slice): sobe só a camada web (controller + segurança), sem BD nem Kafka.
// MockMvc faz pedidos HTTP simulados, sem abrir uma porta. jwt() simula um token já validado.
@WebMvcTest(ActivityController.class)
@Import(SecurityConfig.class)
class ActivityControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ActivityService activityService;

    // Sem isto, o Spring tentava contactar o Keycloak para descarregar chaves.
    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void semToken401() throws Exception {
        mvc.perform(get("/api/activity/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void comTokenMasSemPapelAdmin403() throws Exception {
        mvc.perform(get("/api/activity/summary").with(jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void comPapelAdmin200() throws Exception {
        when(activityService.summary()).thenReturn(new ActivityService.Summary(3, Map.of("task.created", 3L), 1));

        mvc.perform(get("/api/activity/summary").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalEvents").value(3));
    }
}
