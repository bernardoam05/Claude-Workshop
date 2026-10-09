package pt.workshop.activity.events;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

// O contrato do evento, tal como a API Node o publica. Um "record" Java é uma classe imutável
// só com dados: o compilador gera construtor, getters, equals, hashCode e toString.
// É o equivalente à interface TaskEvent do worker em TypeScript: o contrato é o mesmo, a linguagem não.
//
// @JsonIgnoreProperties(ignoreUnknown = true): padrão "tolerant reader". O produtor (API Node) pode
// ACRESCENTAR campos (como created_at) sem partir este consumidor. Sem isto, cada campo novo na API
// obrigava a um deploy coordenado de todos os serviços que leem o tópico.
@JsonIgnoreProperties(ignoreUnknown = true)
public record TaskEvent(String eventId, String type, Instant occurredAt, TaskSnapshot task) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TaskSnapshot(Long id, String title, Boolean done, Long userId) {}
}
