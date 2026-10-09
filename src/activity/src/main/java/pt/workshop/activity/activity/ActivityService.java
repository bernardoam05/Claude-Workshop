package pt.workshop.activity.activity;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pt.workshop.activity.events.TaskEvent;

// Lógica de negócio. Não sabe de Kafka nem de HTTP: recebe um TaskEvent e devolve dados.
// Por isso testa-se com Mockito, sem Kafka, sem Postgres (ver ActivityServiceTest).
@Service
public class ActivityService {

    private final ActivityEventRepository repository;
    private final MeterRegistry meterRegistry;

    public ActivityService(ActivityEventRepository repository, MeterRegistry meterRegistry) {
        this.repository = repository;
        this.meterRegistry = meterRegistry;
    }

    // @Transactional: o Spring abre uma transação antes do método e faz commit no fim (ou rollback se houver exceção).
    // É o BEGIN/COMMIT/ROLLBACK do migrate.js, mas declarativo.
    @Transactional
    public String record(TaskEvent event, int partition, long offset) {
        int inserted = repository.insertIfAbsent(
                UUID.fromString(event.eventId()),
                event.type(),
                event.task().id(),
                event.task().userId(),
                event.task().title(),
                event.occurredAt(),
                partition,
                offset);

        String result = inserted == 1 ? "processado" : "duplicado";
        // Métrica Prometheus: activity_events_processed_total{type="task.created", result="processado"}
        Counter.builder("activity.events.processed")
                .description("Eventos do Kafka processados pelo serviço de atividade")
                .tag("type", event.type())
                .tag("result", result)
                .register(meterRegistry)
                .increment();
        return result;
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        Map<String, Long> byType = new TreeMap<>();
        repository.countByType().forEach(c -> byType.put(c.getType(), c.getTotal()));
        long total = byType.values().stream().mapToLong(Long::longValue).sum();
        return new Summary(total, byType, repository.countDistinctUsers());
    }

    @Transactional(readOnly = true)
    public List<ActivityView> recent() {
        return repository.findTop20ByOrderByReceivedAtDesc().stream().map(ActivityView::from).toList();
    }

    // DTOs: o que a API devolve. Nunca expor a entidade JPA diretamente (acopla o JSON ao schema da BD).
    public record Summary(long totalEvents, Map<String, Long> byType, long distinctUsers) {}

    public record ActivityView(String type, long taskId, long userId, String title,
                               Instant occurredAt, int kafkaPartition, long kafkaOffset) {
        static ActivityView from(ActivityEvent e) {
            return new ActivityView(e.getType(), e.getTaskId(), e.getUserId(), e.getTitle(),
                    e.getOccurredAt(), e.getKafkaPartition(), e.getKafkaOffset());
        }
    }
}
