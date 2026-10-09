package pt.workshop.activity.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pt.workshop.activity.events.TaskEvent;

// Teste de UNIDADE: sem Spring, sem BD, sem Kafka. O repositório é um mock do Mockito
// (o equivalente aos fakes que escrevemos à mão em Node). Corre em milissegundos.
class ActivityServiceTest {

    private ActivityEventRepository repository;
    private SimpleMeterRegistry meters;
    private ActivityService service;

    private final TaskEvent event = new TaskEvent(
            UUID.randomUUID().toString(), "task.completed", Instant.now(),
            new TaskEvent.TaskSnapshot(7L, "Estudar Kafka", true, 1L));

    @BeforeEach
    void setUp() {
        repository = mock(ActivityEventRepository.class);
        meters = new SimpleMeterRegistry();
        service = new ActivityService(repository, meters);
    }

    @Test
    void primeiraEntregaEProcessadaESegundaEDuplicada() {
        when(repository.insertIfAbsent(any(), anyString(), anyLong(), anyLong(), any(), any(), anyInt(), anyLong()))
                .thenReturn(1)   // primeira vez: inseriu
                .thenReturn(0);  // reentrega: ON CONFLICT DO NOTHING

        assertThat(service.record(event, 0, 10)).isEqualTo("processado");
        assertThat(service.record(event, 0, 10)).isEqualTo("duplicado");

        double processed = meters.get("activity.events.processed")
                .tag("type", "task.completed").tag("result", "processado").counter().count();
        assertThat(processed).isEqualTo(1.0);
    }

    @Test
    void resumoSomaOsTotaisPorTipo() {
        when(repository.countByType()).thenReturn(List.of(count("task.created", 3), count("task.completed", 2)));
        when(repository.countDistinctUsers()).thenReturn(2L);

        ActivityService.Summary summary = service.summary();

        assertThat(summary.totalEvents()).isEqualTo(5);
        assertThat(summary.byType()).containsEntry("task.created", 3L).containsEntry("task.completed", 2L);
        assertThat(summary.distinctUsers()).isEqualTo(2);
    }

    private static ActivityEventRepository.TypeCount count(String type, long total) {
        return new ActivityEventRepository.TypeCount() {
            public String getType() { return type; }
            public long getTotal() { return total; }
        };
    }
}
