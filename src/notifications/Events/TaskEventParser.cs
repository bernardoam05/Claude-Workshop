using System.Text.Json;

namespace Notifications.Events;

// Converte o texto da mensagem num TaskEvent válido, ou lança MalformedEventException.
// Nota de linguagem: o System.Text.Json, ao contrário do Jackson (Java), IGNORA por omissão
// campos desconhecidos do JSON — não precisa de um "@JsonIgnoreProperties" equivalente para
// aceitar o "created_at" extra que a API Node envia. Mas os TIPOS continuam a não garantir nada
// em runtime: a validação manual a seguir ao parse continua obrigatória, como nas outras linguagens.
public static class TaskEventParser
{
    private static readonly HashSet<string> KnownTypes = new() { "task.created", "task.completed" };
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static TaskEvent Parse(string json)
    {
        TaskEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<TaskEvent>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new MalformedEventException($"JSON inválido: {ex.Message}");
        }

        if (evt is null || !Guid.TryParse(evt.EventId, out _) || evt.Type is null || !KnownTypes.Contains(evt.Type))
        {
            throw new MalformedEventException("eventId ou type inválidos");
        }
        if (evt.Task is null || evt.Task.Id is null || evt.Task.UserId is null)
        {
            throw new MalformedEventException("task, task.id e task.userId são obrigatórios");
        }
        return evt;
    }
}
