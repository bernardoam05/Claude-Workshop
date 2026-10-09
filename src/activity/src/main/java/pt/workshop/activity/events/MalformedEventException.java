package pt.workshop.activity.events;

// Erro PERMANENTE: repetir não resolve. O error handler do Kafka (KafkaConfig) envia estas mensagens
// diretamente para o Dead Letter Topic, sem retries. É o mesmo papel do MalformedEventError do worker.
public class MalformedEventException extends RuntimeException {

    public MalformedEventException(String message) {
        super(message);
    }

    public MalformedEventException(String message, Throwable cause) {
        super(message, cause);
    }
}
