# 23 · Sintaxe de C# usada neste projeto

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
- `"""texto"""` (string em bruto, *raw string*): permite escrever várias linhas e usar `"` sem ter de escapar nada. Combinada com `$`, continua a interpolar `{variavel}` normalmente — é o que o `ExecuteSqlInterpolatedAsync` usa (módulo 21), e que transforma cada `{valor}` num parâmetro seguro, não em texto concatenado.

## `async`/`await` e `Task`

```csharp
public static async Task<bool> InsertIfAbsentAsync(NotificationsDbContext db, TaskEvent evt)
{
    var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""...""");
    return inserted > 0;
}
```

O mesmo conceito do `async`/`await` de JavaScript (módulo 22): a função pausa em `await` sem bloquear a thread, até a operação assíncrona terminar. `Task` é o equivalente a uma `Promise`; `Task<T>` é uma Promise que vai resolver com um valor do tipo `T`. Por convenção (não obrigação), métodos assíncronos acabam em `Async` — é por isso que vês `BasicAckAsync`, `QueueDeclareAsync`, etc.

## Registos imutáveis (`record`)

```csharp
public record TaskSnapshot(long? Id, string? Title, bool? Done, long? UserId);
public record TaskEvent(string? EventId, string? Type, DateTimeOffset? OccurredAt, TaskSnapshot? Task);
```

Um `record` é uma forma compacta de declarar uma classe **imutável**, só com dados. Esta única linha substitui o que, numa classe normal, seriam ~15 linhas (construtor, propriedades só de leitura, `Equals`, `GetHashCode`, `ToString`). É o equivalente, em espírito, a um `record` do Java (módulo 18) — mesma ideia, dois nomes iguais por coincidência, duas linguagens diferentes.

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

LINQ (*Language Integrated Query*) deixa-te escrever algo que PARECE uma sequência de métodos sobre uma coleção em memória, mas que o Entity Framework Core traduz para SQL real, só executado quando chamas `.ToListAsync()`/`.CountAsync()` (nunca antes — é *lazy*). `.Where(...)` filtra, `.Select(...)` transforma (como o `.map` de JS), `.GroupBy(...)` agrupa, `.OrderByDescending(...)` ordena. O módulo 21 compara isto com SQL à mão (Node) e com JPQL (Spring).

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

`[Fact]` é um **atributo**: metadados colados a um método, lidos por outra ferramenta em runtime (aqui, o xUnit, que usa `[Fact]` para saber "isto é um teste, corre-o"). É o equivalente, em espírito, às anotações `@Test` do Java/JUnit (módulo 18) — mesmo conceito (metadados declarativos), sintaxe `[ ]` em vez de `@`.

## Genéricos (`List<T>`, `Task<T>`, `DbContextOptions<T>`)

```csharp
DbContextOptionsBuilder<NotificationsDbContext> builder
```

O `<T>` entre `< >` diz "este tipo funciona com QUALQUER tipo `T`, mas uma vez escolhido, fica fixo". `DbContextOptionsBuilder<NotificationsDbContext>` é especificamente um construtor de opções PARA o nosso `NotificationsDbContext`, não para qualquer `DbContext`. É o mesmo conceito dos genéricos do Java (`List<String>`) ou do TypeScript (`Promise<string>`).

---

## Prática: escreve tu

Esta chuleta serve para **ler** C#. Os exercícios seguintes servem para o **escrever**, um por cada grupo de secções acima. O código e os testes estão em `pratica/23-sintaxe-csharp/`: cada ficheiro tem os métodos já declarados (para tudo compilar) e o corpo por fazer.

**Verificar:** `npm run verificar 23` (dentro de `pratica/`). Só um exercício: `npm run verificar 23 Registos`, `... 23 Consultas`, `... 23 Padroes` ou `... 23 Assincrono`. Sem o SDK do .NET instalado, corre num contentor Docker.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Records, nullable e strings (≈20 min)

**Ficheiro:** `Registos.cs`. Formatar uma morada com e sem código postal (`is null`), mudá-la com `with` sem alterar a original, escrever JSON à mão com uma **raw string interpolada** (`$$"""..."""`), e lidar com um `string?` que pode ser `null`.

<details>
<summary>Pista</summary>

Numa raw string com **dois** `$` (`$$"""..."""`), as chavetas simples `{ }` são texto normal e só `{{ ... }}` é interpolação. É feito exatamente para JSON, que está cheio de chavetas.
</details>

<details>
<summary>Solução de referência</summary>

```csharp
namespace Sintaxe;

public record Morada(string Rua, string Cidade, string? CodigoPostal);

public static class Registos
{
    // `is null` é a forma idiomática (não pode ser enganada por um operador == redefinido).
    public static string Formatar(Morada morada) =>
        morada.CodigoPostal is null
            ? $"{morada.Rua}, {morada.Cidade}"
            : $"{morada.Rua}, {morada.Cidade} ({morada.CodigoPostal})";

    // `with` cria uma cópia com os campos indicados mudados; o original fica como estava.
    public static Morada MudarDeCidade(Morada morada, string novaCidade) =>
        morada with { Cidade = novaCidade, CodigoPostal = null };

    // $$"""...""": raw string interpolada com DOIS $. As chavetas simples { } são texto normal
    // (dá jeito em JSON), e só {{ ... }} é interpolação.
    public static string ParaJson(string nome, int idade) =>
        $$"""{ "nome": "{{nome}}", "idade": {{idade}} }""";

    public static string PrimeiroNome(string? nomeCompleto)
    {
        if (string.IsNullOrWhiteSpace(nomeCompleto)) return "ANÓNIMO";
        // Depois do IsNullOrWhiteSpace, o compilador sabe que nomeCompleto não é null (sem avisos).
        return nomeCompleto.Trim().Split(' ')[0].ToUpperInvariant();
    }
}
```
</details>

### P2 · LINQ (≈25 min)

**Ficheiro:** `Consultas.cs`. Cinco consultas, cada uma com **uma** expressão: filtrar e ordenar, agrupar e somar (`GroupBy` + `ToDictionary`), o grupo com o maior total (`MaxBy`), "todas" e "alguma" (`All`/`Any`), e paginar (`Skip`/`Take`).

<details>
<summary>Pista</summary>

Cuidado com o `ProjetoConcluido` para um projeto que não existe: `All` numa lista **vazia** dá `true` ("todas as zero tarefas estão feitas"). É lógica matemática correta, mas não é o que a regra pede.
</details>

<details>
<summary>Solução de referência</summary>

```csharp
namespace Sintaxe;

public record Tarefa(int Id, string Titulo, bool Feita, string Projeto, int Minutos);

public static class Consultas
{
    public static List<string> TitulosPorFazer(IEnumerable<Tarefa> tarefas) =>
        tarefas.Where(t => !t.Feita).Select(t => t.Titulo).Order().ToList();

    public static Dictionary<string, int> MinutosPorProjeto(IEnumerable<Tarefa> tarefas) =>
        tarefas.GroupBy(t => t.Projeto).ToDictionary(g => g.Key, g => g.Sum(t => t.Minutos));

    // MaxBy devolve o elemento com o maior valor (ou null numa sequência vazia); ?. propaga o null.
    public static string? ProjetoMaisAtrasado(IEnumerable<Tarefa> tarefas) =>
        tarefas.Where(t => !t.Feita)
            .GroupBy(t => t.Projeto)
            .MaxBy(g => g.Sum(t => t.Minutos))
            ?.Key;

    // All() numa sequência vazia é true ("todas as zero tarefas estão feitas"): daí o Any() antes.
    public static bool ProjetoConcluido(IEnumerable<Tarefa> tarefas, string projeto)
    {
        var doProjeto = tarefas.Where(t => t.Projeto == projeto).ToList();
        return doProjeto.Any() && doProjeto.All(t => t.Feita);
    }

    public static List<Tarefa> Pagina(IEnumerable<Tarefa> tarefas, int pagina, int tamanho) =>
        tarefas.OrderBy(t => t.Id).Skip((pagina - 1) * tamanho).Take(tamanho).ToList();
}
```

Compara com o P1 do [módulo 18](18-spring-boot.md#prática-escreve-tu): o LINQ e as Streams do Java fazem o mesmo, com nomes diferentes (`Where`/`filter`, `Select`/`map`, `GroupBy`/`groupingBy`).
</details>

### P3 · Pattern matching (≈20 min)

**Ficheiro:** `Padroes.cs`. Um só `switch` expression que classifica qualquer valor: `null`, inteiros (com uma condição `when` e uma constante), strings (com um padrão de propriedade `{ Length: 0 }`) e arrays com **list patterns** (`[]`, `[var unico]`, `[var primeiro, .., var ultimo]`).

<details>
<summary>Pista</summary>

A ordem dos casos importa: o primeiro que bater ganha, por isso os mais específicos vêm primeiro. E como o valor é um `object`, um list pattern sozinho não compila (um `object` não é uma lista): junta-o ao tipo com `and`, como em `int[] and [var unico]`.
</details>

<details>
<summary>Solução de referência</summary>

```csharp
namespace Sintaxe;

public static class Padroes
{
    // Os casos são testados POR ORDEM: o primeiro que bater ganha. Por isso os mais específicos
    // (int < 0, int 0) vêm antes do mais geral (int).
    public static string Classificar(object? valor) => valor switch
    {
        null => "nada",
        int n when n < 0 => "negativo",      // guarda com `when`...
        0 => "zero",                          // ...ou um padrão constante
        int => "positivo",                    // padrão de tipo
        string { Length: 0 } => "texto vazio", // padrão de propriedade
        string s => $"texto com {s.Length} caracteres",
        // List patterns (C# 11). `and` junta dois padrões: primeiro "é um int[]", depois a forma da lista.
        int[] and [] => "lista vazia",
        int[] and [var unico] => $"só o {unico}",
        int[] and [var primeiro, .., var ultimo] => $"de {primeiro} a {ultimo}", // `..` = qualquer coisa no meio
        _ => "desconhecido",                  // o "default" de um switch expression
    };
}
```
</details>

### P4 · `async`, `Task` e genéricos (≈30 min)

**Ficheiro:** `Assincrono.cs`. Carregar vários itens **em paralelo** (`Task.WhenAll`), esperar por uma tarefa com um limite de tempo (`Task.WhenAny`), e um iterador assíncrono (`IAsyncEnumerable` com `yield return`) que respeita um `CancellationToken`. Os métodos são **genéricos**: funcionam para qualquer tipo de resultado.

<details>
<summary>Pista</summary>

`ids.Select(carregar)` cria todas as `Task` de uma vez (e cada uma começa logo a correr); `Task.WhenAll` espera por todas e devolve os resultados **pela ordem das tasks**, não pela ordem em que acabaram. É o `Promise.all` do JavaScript. No iterador, `yield return` entrega um valor e pausa até quem consome (`await foreach`) pedir o seguinte.
</details>

<details>
<summary>Solução de referência</summary>

```csharp
using System.Runtime.CompilerServices;

namespace Sintaxe;

public static class Assincrono
{
    // Select cria TODAS as Tasks logo (começam já a correr); WhenAll espera por todas,
    // e devolve os resultados pela ordem das Tasks, não pela ordem em que acabaram.
    public static Task<TResultado[]> CarregarTodos<TResultado>(IEnumerable<int> ids, Func<int, Task<TResultado>> carregar) =>
        Task.WhenAll(ids.Select(carregar));

    public static async Task<T> ComLimiteDeTempo<T>(Task<T> tarefa, TimeSpan limite, T porOmissao)
    {
        // WhenAny devolve a primeira a acabar: ou a tarefa, ou o "despertador".
        var primeira = await Task.WhenAny(tarefa, Task.Delay(limite));
        return primeira == tarefa ? await tarefa : porOmissao;
    }

    // Um iterador assíncrono: `yield return` entrega um valor de cada vez a quem faz `await foreach`.
    public static async IAsyncEnumerable<int> Contar(int ate, TimeSpan pausa, [EnumeratorCancellation] CancellationToken token = default)
    {
        for (var i = 1; i <= ate && !token.IsCancellationRequested; i++)
        {
            yield return i;
            await Task.Delay(pausa); // (sem passar o token: cancelado a meio, o Delay lançaria uma exceção)
        }
    }
}
```
</details>

## Como usar isto na prática

Não leias isto de uma vez. Quando o módulo 21 te mandar abrir um ficheiro `.cs` e uma linha não fizer sentido: volta aqui, procura o símbolo (`?`, `record`, `using`, `<T>`), lê a explicação, e volta ao ficheiro.
