# 22 · Sintaxe de C# usada neste projeto

**Isto não é um curso de C#.** É uma referência rápida para as construções que vais encontrar em `src/notifications`. Não precisas de a ler de uma vez — procura a construção quando uma linha não fizer sentido, lê a explicação, volta ao ficheiro. Cada entrada usa uma linha **real** do projeto.

Se preferires uma introdução mais estruturada, o [tour oficial da linguagem C#](https://learn.microsoft.com/pt-pt/dotnet/csharp/tour-of-csharp/) é gratuito e bem feito.

---

## `var`: o tipo infere-se, não desaparece

```csharp
var builder = WebApplication.CreateBuilder(args);
```

`var` não é "qualquer tipo" (como `any` em TypeScript) — o compilador **sabe exatamente** o tipo de `builder` (é `WebApplicationBuilder`), só não o escreveste tu. É só conveniência de leitura; o C# continua fortemente tipado. Diferente do `let`/`const` de JS: lá o tipo pode mudar de facto; aqui nunca muda, só não o escreveste.

## Propriedades (`{ get; set; }`)

```csharp
public class Notification
{
    public Guid EventId { get; set; }
    public string Type { get; set; } = "";
    public string? Title { get; set; }
}
```

Uma propriedade parece um campo público, mas é na verdade um par de métodos (`get`/`set`) gerados automaticamente. Podias escrever lógica própria em cada um, mas aqui são "automáticas" (*auto-implemented*). `= ""` é um valor por omissão, atribuído quando o objeto é criado sem outro valor.

## `?` depois do tipo: tipos anuláveis (nullable)

```csharp
public string? Title { get; set; }          // PODE ser null
public long TaskId { get; set; }            // NUNCA pode ser null
```

Com `<Nullable>enable</Nullable>` no `.csproj` (como aqui), o compilador distingue `string` (nunca `null`, ou avisa-te) de `string?` (pode ser `null`, e obriga-te a verificar antes de usar). É uma rede de segurança contra o erro mais comum em C#/Java antigos: um `NullReferenceException` a meio da noite.

## `is null` / `is not null`: a forma idiomática de comparar com null

```csharp
if (realmAccessJson is null) return;
if (evt.Task is null || evt.Task.Id is null) { ... }
```

Funciona como `== null`, mas é a forma recomendada em C# moderno (não pode ser "enganada" por um operador `==` sobrecarregado de forma estranha numa classe). `is` é também o operador de **pattern matching** — o mesmo `is` aparece em formas mais avançadas que não precisas aqui.

## Interpolação de strings (`$"..."`) e strings em bruto (`"""..."""`)

```csharp
throw new InvalidOperationException($"Variável de ambiente obrigatória em falta: {name}");

var sql = $"""
    INSERT INTO notifications.notifications (event_id, type)
    VALUES ({eventId}, {type})
    ON CONFLICT (event_id) DO NOTHING
    """;
```

- `$"texto {variavel}"`: como os template literals de JS (`` `${}` ``), mas com `$` em vez de crases.
- `"""texto"""` (string em bruto, *raw string*): permite escrever várias linhas e usar `"` sem ter de escapar nada. Combinada com `$`, continua a interpolar `{variavel}` normalmente — é o que o `ExecuteSqlInterpolatedAsync` usa (módulo 20), e que transforma cada `{valor}` num parâmetro seguro, não em texto concatenado.

## `async`/`await` e `Task`

```csharp
public static async Task<bool> InsertIfAbsentAsync(NotificationsDbContext db, TaskEvent evt)
{
    var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""...""");
    return inserted > 0;
}
```

O mesmo conceito do `async`/`await` de JavaScript (módulo 21): a função pausa em `await` sem bloquear a thread, até a operação assíncrona terminar. `Task` é o equivalente a uma `Promise`; `Task<T>` é uma Promise que vai resolver com um valor do tipo `T`. Por convenção (não obrigação), métodos assíncronos acabam em `Async` — é por isso que vês `BasicAckAsync`, `QueueDeclareAsync`, etc.

## Registos imutáveis (`record`)

```csharp
public record TaskSnapshot(long? Id, string? Title, bool? Done, long? UserId);
public record TaskEvent(string? EventId, string? Type, DateTimeOffset? OccurredAt, TaskSnapshot? Task);
```

Um `record` é uma forma compacta de declarar uma classe **imutável**, só com dados. Esta única linha substitui o que, numa classe normal, seriam ~15 linhas (construtor, propriedades só de leitura, `Equals`, `GetHashCode`, `ToString`). É o equivalente, em espírito, a um `record` do Java (módulo 17) — mesma ideia, dois nomes iguais por coincidência, duas linguagens diferentes.

## Construtores primários (C# 12+)

```csharp
public class RabbitMqConsumer(IServiceScopeFactory scopeFactory, ILogger<RabbitMqConsumer> logger) : BackgroundService
```

Isto declara uma classe **e** o seu construtor na mesma linha: `scopeFactory` e `logger` ficam disponíveis em qualquer método da classe, sem teres de escrever `private readonly IServiceScopeFactory _scopeFactory;` e um construtor à parte. É açúcar sintáctico recente — o compilador gera o equivalente "à mão antiga" por trás.

`: BackgroundService` depois dos parênteses diz que esta classe **herda** de `BackgroundService` (uma classe do ASP.NET Core para processos que correm em fundo, como o nosso consumidor RabbitMQ).

## LINQ: consultas escritas como C#, não como SQL

```csharp
var total = await db.Notifications.CountAsync();

var byType = await db.Notifications
    .GroupBy(n => n.Type)
    .Select(g => new { type = g.Key, total = g.Count() })
    .ToListAsync();

var items = await db.Notifications
    .OrderByDescending(n => n.ReceivedAt)
    .Take(20)
    .ToListAsync();
```

LINQ (*Language Integrated Query*) deixa-te escrever algo que PARECE uma sequência de métodos sobre uma coleção em memória, mas que o Entity Framework Core traduz para SQL real, só executado quando chamas `.ToListAsync()`/`.CountAsync()` (nunca antes — é *lazy*). `.Where(...)` filtra, `.Select(...)` transforma (como o `.map` de JS), `.GroupBy(...)` agrupa, `.OrderByDescending(...)` ordena. O módulo 20 compara isto com SQL à mão (Node) e com JPQL (Spring).

## `using` (duas coisas diferentes, mesma palavra)

```csharp
using Microsoft.EntityFrameworkCore;    // 1) no topo do ficheiro: importa um namespace (como "import" em JS)

using var doc = JsonDocument.Parse(realmAccessJson);   // 2) "using var": liberta recursos automaticamente
```

- No **topo do ficheiro**, `using X;` é o equivalente ao `import` de JavaScript ou Java — dá-te acesso aos tipos desse namespace.
- `using var algo = ...;` (ou um bloco `using (...) { }`) garante que o recurso (aqui, um `JsonDocument`, que usa memória não-gerida por trás) é **libertado automaticamente** no fim do método ou do bloco, mesmo que aconteça uma excepção a meio. É o equivalente ao `try/finally` que farias à mão, feito pelo compilador.

## Atributos (`[Fact]`, `[Fact(Skip = "...")]`)

```csharp
[Fact]
public void LeUmEventoValidoTalComoAApiNodeOPublica()
{
    var evt = TaskEventParser.Parse(ValidJson);
    Assert.Equal("task.completed", evt.Type);
}
```

`[Fact]` é um **atributo**: metadados colados a um método, lidos por outra ferramenta em runtime (aqui, o xUnit, que usa `[Fact]` para saber "isto é um teste, corre-o"). É o equivalente, em espírito, às anotações `@Test` do Java/JUnit (módulo 17) — mesmo conceito (metadados declarativos), sintaxe `[ ]` em vez de `@`.

## Genéricos (`List<T>`, `Task<T>`, `DbContextOptions<T>`)

```csharp
DbContextOptionsBuilder<NotificationsDbContext> builder
```

O `<T>` entre `< >` diz "este tipo funciona com QUALQUER tipo `T`, mas uma vez escolhido, fica fixo". `DbContextOptionsBuilder<NotificationsDbContext>` é especificamente um construtor de opções PARA o nosso `NotificationsDbContext`, não para qualquer `DbContext`. É o mesmo conceito dos genéricos do Java (`List<String>`) ou do TypeScript (`Promise<string>`).

---

## Como usar isto na prática

Não leias isto de uma vez. Quando o módulo 20 te mandar abrir um ficheiro `.cs` e uma linha não fizer sentido: volta aqui, procura o símbolo (`?`, `record`, `using`, `<T>`), lê a explicação, e volta ao ficheiro.
