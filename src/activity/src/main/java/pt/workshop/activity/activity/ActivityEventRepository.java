package pt.workshop.activity.activity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// Spring Data JPA: declaras uma INTERFACE e o Spring gera a implementação em runtime.
// - findAll, findById, save, count... vêm de JpaRepository;
// - findTop20ByOrderByReceivedAtDesc é gerado a partir do NOME do método;
// - @Query permite JPQL (sobre entidades) ou SQL nativo (sobre tabelas).
public interface ActivityEventRepository extends JpaRepository<ActivityEvent, UUID> {

    // SQL nativo, porque o JPA não tem "ON CONFLICT". É a mesma idempotência do worker em Node:
    // devolve 1 se inseriu, 0 se o evento já existia (reentrega). Atómico, sem SELECT antes.
    @Modifying
    @Query(value = """
            INSERT INTO activity_events
              (event_id, type, task_id, user_id, title, occurred_at, kafka_partition, kafka_offset)
            VALUES (:eventId, :type, :taskId, :userId, :title, :occurredAt, :partition, :offset)
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("eventId") UUID eventId,
                       @Param("type") String type,
                       @Param("taskId") long taskId,
                       @Param("userId") long userId,
                       @Param("title") String title,
                       @Param("occurredAt") Instant occurredAt,
                       @Param("partition") int partition,
                       @Param("offset") long offset);

    // JPQL: escreve-se sobre a ENTIDADE (ActivityEvent, e.type), não sobre a tabela.
    @Query("select e.type as type, count(e) as total from ActivityEvent e group by e.type")
    List<TypeCount> countByType();

    @Query("select count(distinct e.userId) from ActivityEvent e")
    long countDistinctUsers();

    List<ActivityEvent> findTop20ByOrderByReceivedAtDesc();

    // Projeção: o Spring cria um objeto que implementa esta interface com as colunas "type" e "total".
    interface TypeCount {
        String getType();
        long getTotal();
    }
}
