using System.Text;
using Microsoft.EntityFrameworkCore;
using Notifications.Data;
using Notifications.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Notifications.Messaging;

// Consumidor RabbitMQ. Repara no binding: "task.completed", não "task.*" como o worker (Node).
// É a prova de que VÁRIOS consumidores independentes reagem ao MESMO exchange, cada um com a
// sua fila e o seu propósito — o fan-out do módulo 06, agora com três linguagens a demonstrá-lo.
public class RabbitMqConsumer(IServiceScopeFactory scopeFactory, ILogger<RabbitMqConsumer> logger) : BackgroundService
{
    private const string Exchange = "tasks";
    private const string Queue = "notifications.task-completed";
    private const string Dlx = "notifications.dlx";
    private const string Dlq = "notifications.task-completed.dlq";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var connection = await ConnectWithRetryAsync(stoppingToken);

        // Mesmo princípio do worker (Node): se a ligação cair, saímos com erro em vez de ficar
        // "vivo e surdo". O Docker (restart policy) reinicia-nos com estado limpo.
        connection.ConnectionShutdownAsync += (_, reason) =>
        {
            logger.LogError("Ligação ao RabbitMQ perdida ({Reason}); a sair para o Docker reiniciar", reason.ReplyText);
            Environment.Exit(1);
            return Task.CompletedTask;
        };

        var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, cancellationToken: stoppingToken);
        await channel.ExchangeDeclareAsync(Dlx, ExchangeType.Fanout, durable: true, cancellationToken: stoppingToken);
        await channel.QueueDeclareAsync(Dlq, durable: true, exclusive: false, autoDelete: false, cancellationToken: stoppingToken);
        await channel.QueueBindAsync(Dlq, Dlx, routingKey: "", cancellationToken: stoppingToken);

        var queueArgs = new Dictionary<string, object?> { ["x-dead-letter-exchange"] = Dlx };
        await channel.QueueDeclareAsync(Queue, durable: true, exclusive: false, autoDelete: false,
            arguments: queueArgs, cancellationToken: stoppingToken);
        await channel.QueueBindAsync(Queue, Exchange, routingKey: "task.completed", cancellationToken: stoppingToken);

        // Controlo de fluxo: no máximo 10 mensagens entregues e ainda não confirmadas.
        await channel.BasicQosAsync(0, prefetchCount: 10, global: false, cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                var evt = TaskEventParser.Parse(json);

                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<NotificationsDbContext>();
                var inserted = await NotificationRepository.InsertIfAbsentAsync(db, evt);

                logger.LogInformation("{Type} -> {Result}", evt.Type, inserted ? "processado" : "duplicado");
                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
            }
            catch (MalformedEventException ex)
            {
                logger.LogError("Mensagem inválida -> DLQ: {Message}", ex.Message);
                await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false, cancellationToken: stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError("Erro transitório, a devolver à fila: {Message}", ex.Message);
                await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true, cancellationToken: stoppingToken);
            }
        };

        await channel.BasicConsumeAsync(Queue, autoAck: false, consumer, cancellationToken: stoppingToken);
        logger.LogInformation("A consumir {Queue}", Queue);

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    private async Task<IConnection> ConnectWithRetryAsync(CancellationToken ct, int retries = 10, int delayMs = 2000)
    {
        var factory = new ConnectionFactory { Uri = new Uri(Config.RabbitMqUrl) };
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await factory.CreateConnectionAsync(ct);
            }
            catch when (attempt < retries)
            {
                logger.LogWarning("RabbitMQ indisponível (tentativa {Attempt}), a repetir...", attempt);
                await Task.Delay(delayMs, ct);
            }
        }
    }
}
