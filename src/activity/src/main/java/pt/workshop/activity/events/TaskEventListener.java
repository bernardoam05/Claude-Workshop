package pt.workshop.activity.events;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import pt.workshop.activity.activity.ActivityService;

// Consumidor Kafka. Comparação com o worker do RabbitMQ:
// - Não há ack/nack por mensagem. O consumidor guarda um OFFSET por partição ("li até aqui").
//   O Spring faz commit do offset depois de o método terminar sem erro.
// - Se o método lançar exceção, o DefaultErrorHandler (KafkaConfig) repete e, no fim, envia para o DLT.
// - groupId: todas as instâncias com o mesmo groupId DIVIDEM as partições entre si (escalam juntas).
//   Um groupId diferente recebe TODAS as mensagens desde o início (auto-offset-reset: earliest).
@Component
public class TaskEventListener {

    private static final Logger log = LoggerFactory.getLogger(TaskEventListener.class);

    private final TaskEventParser parser;
    private final ActivityService activityService;

    public TaskEventListener(TaskEventParser parser, ActivityService activityService) {
        this.parser = parser;
        this.activityService = activityService;
    }

    @KafkaListener(topics = "${app.kafka.topic}", groupId = "${spring.kafka.consumer.group-id}")
    public void onMessage(ConsumerRecord<String, String> record) {
        TaskEvent event = parser.parse(record.value());
        String result = activityService.record(event, record.partition(), record.offset());
        log.info("{} (key={}, partição={}, offset={}) → {}",
                event.type(), record.key(), record.partition(), record.offset(), result);
    }
}
