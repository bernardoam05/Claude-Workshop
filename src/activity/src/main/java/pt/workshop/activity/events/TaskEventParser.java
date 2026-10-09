package pt.workshop.activity.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

// Converte o texto da mensagem num TaskEvent válido, ou lança MalformedEventException.
// Tal como no worker: os tipos Java NÃO garantem que o JSON que chega tem a forma certa.
// A validação em runtime continua a ser obrigatória.
@Component
public class TaskEventParser {

    private static final Set<String> KNOWN_TYPES = Set.of("task.created", "task.completed");

    private final ObjectMapper objectMapper;

    // Injeção por construtor: o Spring passa o ObjectMapper que já configurou (com suporte a Instant, etc.).
    public TaskEventParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public TaskEvent parse(String json) {
        TaskEvent event;
        try {
            event = objectMapper.readValue(json, TaskEvent.class);
        } catch (JsonProcessingException e) {
            throw new MalformedEventException("JSON inválido", e);
        }

        if (event == null || !isUuid(event.eventId()) || !KNOWN_TYPES.contains(event.type())) {
            throw new MalformedEventException("eventId ou type inválidos");
        }
        if (event.task() == null || event.task().id() == null || event.task().userId() == null) {
            throw new MalformedEventException("task, task.id e task.userId são obrigatórios");
        }
        return event;
    }

    private static boolean isUuid(String value) {
        if (value == null) return false;
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
