using Notifications.Events;

namespace Notifications.Tests;

// Teste de unidade puro: sem BD, sem RabbitMQ. O equivalente a TaskEventParserTest.java
// e aos testes do parseJson/isTaskEvent do worker (TypeScript) — a mesma garantia, 3ª linguagem.
public class TaskEventParserTests
{
    private const string ValidJson = """
        {"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.completed",
         "occurredAt":"2026-10-10T10:00:00Z",
         "task":{"id":5,"title":"x","done":true,"created_at":"2026-10-10T10:00:00Z","userId":3}}
        """;

    [Fact]
    public void LeUmEventoValidoTalComoAApiNodeOPublica()
    {
        var evt = TaskEventParser.Parse(ValidJson);

        Assert.Equal("task.completed", evt.Type);
        Assert.Equal(3, evt.Task!.UserId);
    }

    [Fact]
    public void CampoExtraDesconhecidoNaoPartNadaAoContrarioDoJackson()
    {
        // "created_at" não existe no record TaskSnapshot. O System.Text.Json ignora-o por
        // omissão (ao contrário do Jackson/Java, que precisou de @JsonIgnoreProperties).
        var evt = TaskEventParser.Parse(ValidJson);
        Assert.Equal(5, evt.Task!.Id);
    }

    [Fact]
    public void JsonInvalidoEPermanente()
    {
        Assert.Throws<MalformedEventException>(() => TaskEventParser.Parse("{isto não é json"));
    }

    [Fact]
    public void TipoDesconhecidoEhRejeitado()
    {
        const string json = """{"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.apagado","task":{"id":1,"userId":1}}""";
        Assert.Throws<MalformedEventException>(() => TaskEventParser.Parse(json));
    }

    [Fact]
    public void SemTaskEhRejeitado()
    {
        const string json = """{"eventId":"8f1c2a9e-1b2c-4d3e-8f00-123456789abc","type":"task.created"}""";
        Assert.Throws<MalformedEventException>(() => TaskEventParser.Parse(json));
    }
}
