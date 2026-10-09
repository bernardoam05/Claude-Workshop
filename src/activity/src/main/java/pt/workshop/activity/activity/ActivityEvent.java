package pt.workshop.activity.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

// Entidade JPA: uma classe mapeada para uma tabela. O Hibernate (ORM) traduz objetos em linhas e vice-versa.
// O schema NÃO é criado pelo Hibernate: é o Flyway (db/migration) que o cria, e o Hibernate só o valida
// (spring.jpa.hibernate.ddl-auto=validate). Em produção, nunca deixes o ORM alterar o schema sozinho.
@Entity
@Table(name = "activity_events")
public class ActivityEvent {

    @Id
    @Column(name = "event_id")
    private UUID eventId;

    private String type;

    @Column(name = "task_id")
    private long taskId;

    @Column(name = "user_id")
    private long userId;

    private String title;

    @Column(name = "occurred_at")
    private Instant occurredAt;

    @Column(name = "received_at", insertable = false, updatable = false)
    private Instant receivedAt;

    @Column(name = "kafka_partition")
    private int kafkaPartition;

    @Column(name = "kafka_offset")
    private long kafkaOffset;

    // O JPA exige um construtor sem argumentos (cria o objeto e depois preenche os campos por reflexão).
    protected ActivityEvent() {}

    public UUID getEventId() { return eventId; }
    public String getType() { return type; }
    public long getTaskId() { return taskId; }
    public long getUserId() { return userId; }
    public String getTitle() { return title; }
    public Instant getOccurredAt() { return occurredAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public int getKafkaPartition() { return kafkaPartition; }
    public long getKafkaOffset() { return kafkaOffset; }
}
