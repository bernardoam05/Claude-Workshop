package pt.workshop.activity.config;

import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;
import pt.workshop.activity.events.MalformedEventException;

// O que acontece quando o listener lança uma exceção. É a versão Kafka da DLQ do RabbitMQ:
// - erro transitório (BD em baixo): repete 2 vezes, com 1 s entre tentativas;
// - se continuar a falhar, OU se for MalformedEventException (permanente): publica no tópico "task-events.DLT"
//   e avança o offset. Sem isto, uma mensagem envenenada bloqueava a partição para sempre,
//   porque o Kafka entrega por ordem: a mensagem seguinte só vem depois desta.
@Configuration
public class KafkaConfig {

    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<Object, Object> template) {
        // Partição -1: deixa o Kafka escolher a partição no DLT (que tem só uma).
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
                (record, ex) -> new TopicPartition(record.topic() + ".DLT", -1));

        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2));
        handler.addNotRetryableExceptions(MalformedEventException.class);
        return handler;
    }
}
