package pt.workshop.activity.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

class TaskEventParserTest {

    // Fora do Spring temos de registar o módulo de datas (Instant) à mão; dentro do Spring é automático.
    private final TaskEventParser parser = new TaskEventParser(new ObjectMapper().registerModule(new JavaTimeModule()));

    @Test
    void leUmEventoValidoTalComoAApiNodeOPublica() {
        String json = """
                {"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.created",
                 "occurredAt":"2026-10-04T10:00:00.000Z",
                 "task":{"id":5,"title":"x","done":false,"created_at":"2026-10-04T10:00:00Z","userId":3}}
                """;

        TaskEvent event = parser.parse(json);

        assertThat(event.type()).isEqualTo("task.created");
        assertThat(event.task().userId()).isEqualTo(3L);
    }

    @Test
    void jsonInvalidoEPermanente() {
        assertThatThrownBy(() -> parser.parse("{isto não é json"))
                .isInstanceOf(MalformedEventException.class);
    }

    @Test
    void tipoDesconhecidoOuSemTaskSaoRejeitados() {
        assertThatThrownBy(() -> parser.parse("""
                {"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.apagado","task":{"id":1,"userId":1}}
                """)).isInstanceOf(MalformedEventException.class);
        assertThatThrownBy(() -> parser.parse("""
                {"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.created"}
                """)).isInstanceOf(MalformedEventException.class);
    }
}
