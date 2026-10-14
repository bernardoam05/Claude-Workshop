# 21 · C# e .NET

**Objetivo:** ler e escrever um microserviço ASP.NET Core como os que vais encontrar em bancos, seguradoras e consultoras com forte presença Microsoft — e perceber onde se parece e onde difere do que já viste em Node e em Spring Boot.

**Código:** `src/notifications/`. Lê por esta ordem: `Notifications.csproj` → `Program.cs` → `Config.cs` → `Data/` → `Events/` → `Messaging/RabbitMqConsumer.cs` → `Auth/KeycloakRoleClaims.cs`.

> Se a sintaxe de C# ainda não for familiar (`record`, construtores primários, LINQ, `?`...), o [módulo 23](23-sintaxe-csharp.md) é uma referência rápida com linhas reais deste serviço.

---

## 1. O que este serviço faz

- **Consome** o tópico `tasks` do RabbitMQ — mas só a routing key `task.completed`, não `task.*` como o worker (módulo 07). É outro consumidor independente, com a sua própria fila, no mesmo exchange.
- **Guarda** cada notificação no schema `notifications` do Postgres, de forma idempotente, com EF Core.
- **Expõe** `GET /api/notifications/summary` e `/recent`, só para quem tiver o papel `admin` no Keycloak.

Experimenta: `carla` (admin) vê; `alice` recebe 403. Ou corre `./scripts/smoke-test.sh`, que testa os dois, mais a Dead Letter Queue.

## 2. Dicionário: Node / Spring / .NET

| Conceito | Node (API) | Spring (activity) | .NET (notifications) |
|---|---|---|---|
| Gestor de dependências | npm | Maven | NuGet (`dotnet add package`) |
| Injeção de dependências | manual (`index.js`) | contentor do Spring | contentor **nativo** do `WebApplication.CreateBuilder` |
| Rotas | Express Router | `@RestController` | **Minimal API** (`app.MapGet(...)`) |
| Acesso a dados | SQL à mão (`pg`) | JPA/Hibernate | **EF Core** (outro ORM, outra filosofia) |
| Migrações | `migrate.js` + `.sql` | Flyway | **EF Core Migrations** (`dotnet ef migrations add`) |
| Validar JWT | `oidcVerifier.js` (jose) | `spring-boot-starter-oauth2-resource-server` | `Microsoft.AspNetCore.Authentication.JwtBearer` |
| Papéis do Keycloak | (não aplicável aqui) | conversor `KeycloakRealmRoles` | conversor `KeycloakRoleClaims` — **o mesmo bug, a 3ª vez** |
| Consumidor de mensagens | `amqplib` (worker) | `@KafkaListener` (Kafka) | `RabbitMQ.Client` v7, **assíncrono** |
| Testes | `node:test` + fakes | JUnit + Mockito + MockMvc | **xUnit** + testes de integração reais |
| Build | — (JS corre direto) | `mvn package` | `dotnet publish` |

A entrada mais importante desta tabela é a de **DI**: no Node, ligámos tudo à mão no `index.js` (módulo 04) para ires sentir o que um contentor de DI faz por ti. No Spring, o contentor existe mas precisa de anotações. No .NET, a injeção de dependências está **no próprio SDK**, sem framework adicional — é parte da linguagem/plataforma, não uma biblioteca que se escolhe.

## 3. Minimal APIs: rotas sem classes

```csharp
var app = builder.Build();

app.MapGet("/api/notifications/summary", async (NotificationsDbContext db) =>
{
    var total = await db.Notifications.CountAsync();
    return Results.Ok(new { totalNotifications = total });
}).RequireAuthorization("AdminOnly");
```

Nada de classes `Controller`, nada de anotações `@GetMapping`. Uma rota é uma função. O parâmetro `NotificationsDbContext db` é **injetado automaticamente** — o framework vê que o endpoint pede um `NotificationsDbContext` e vai buscá-lo ao contentor de DI, sem teres de o pedir explicitamente. É o equivalente, em espírito, aos endpoints do Express, mas com injeção de dependências a aparecer "de graça" na assinatura da função.

**Quando usar Controllers em vez de Minimal APIs?** Projetos grandes, com muitas rotas e convenções de equipa mais rígidas, costumam preferir Controllers (classes com atributos `[HttpGet]`, mais parecido com o Spring). Minimal APIs ganham em projetos pequenos/médios e em microserviços — exatamente o caso aqui.

## 4. Injeção de dependências, a sério desta vez

```csharp
public class RabbitMqConsumer(IServiceScopeFactory scopeFactory, ILogger<RabbitMqConsumer> logger) : BackgroundService
```

Isto é um **construtor primário** (C# 12+): os parâmetros do construtor declaram-se na própria assinatura da classe. `IServiceScopeFactory` e `ILogger<T>` são pedidos ao contentor, que os fornece quando o `BackgroundService` é criado (`builder.Services.AddHostedService<RabbitMqConsumer>()`).

**Porque `IServiceScopeFactory` e não `NotificationsDbContext` diretamente?** O `DbContext` tem um ciclo de vida **Scoped** (uma instância por pedido HTTP, ou por execução). Um `BackgroundService` vive para sempre — pedir um `DbContext` Scoped diretamente no construtor dava-te a MESMA instância para todas as mensagens, para sempre, o que corrompe o estado interno do EF Core com concorrência. Por isso criamos um `scope` novo a cada mensagem (`scopeFactory.CreateScope()`), com o seu próprio `DbContext`.

## 5. EF Core: o terceiro ORM que vês neste workshop

Três formas de falar com a mesma ideia de "uma tabela de notificações", três filosofias:

| | Node (`pg`) | Spring (JPA/Hibernate) | .NET (EF Core) |
|---|---|---|---|
| Como se escreve uma query | SQL à mão, sempre | JPQL, ou métodos derivados do nome | **LINQ** (consultas em C#, traduzidas para SQL) |
| `db.Notifications.Where(n => n.Type == "x").CountAsync()` | — | `repository.countByType(x)` | é LINQ: parece C#, não SQL |
| SQL que não encaixa no ORM | é tudo SQL | `@Query(nativeQuery = true)` | `ExecuteSqlInterpolatedAsync` (ver `NotificationRepository.cs`) |
| Migrações | escritas à mão | geradas, mas tu escreves o SQL | **geradas automaticamente** a partir do modelo C# |

Repara em `Data/NotificationsDbContext.cs`: a classe `Notification` é só um C# normal (`public Guid EventId { get; set; }`). O `OnModelCreating` mapeia-a para a tabela e colunas em snake_case. Depois, `dotnet ef migrations add InitialCreate` **lê esse modelo e escreve o SQL por ti** — ao contrário do Flyway (que exige SQL escrito à mão) ou do nosso `migrate.js` (idem). É mais rápido a prototipar, e mais fácil de a migração ficar dessincronizada do que esperas se não perceberes o que o EF gerou — por isso o módulo manda-te **sempre ler** o ficheiro gerado em `Migrations/*_InitialCreate.cs` antes de confiar nele.

### Uma armadilha real, encontrada ao escrever isto

A primeira tentativa de gerar a migração falhou com `"no schema has been selected to create in"`. A causa: configurámos a ligação com `Search Path=notifications` (para apontar para o schema do serviço) **antes** de esse schema existir — e a própria tabela de histórico de migrações do EF Core tenta criar-se logo no arranque, num schema que ainda não foi criado. A correção foi configurar o schema das migrações explicitamente (`MigrationsHistoryTable("__EFMigrationsHistory", "notifications")`) em vez de depender do `search_path` da ligação — ver `Config.ConfigureNpgsql`. **Lição:** `HasDefaultSchema` qualifica as TUAS tabelas, mas não resolve, por si só, onde a infraestrutura interna do EF Core se cria.

## 6. `ExecuteSqlInterpolatedAsync`: SQL em bruto, sem SQL injection

```csharp
await db.Database.ExecuteSqlInterpolatedAsync($"""
    INSERT INTO notifications.notifications (event_id, type, task_id, user_id, title, occurred_at)
    VALUES ({eventId}, {type}, {taskId}, {userId}, {title}, {occurredAt})
    ON CONFLICT (event_id) DO NOTHING
    """);
```

Parece concatenação de strings, mas **não é**: `ExecuteSqlInterpolatedAsync` reconhece a sintaxe de interpolação do C# (`$"""..."""`) e transforma cada `{valor}` num parâmetro real, exatamente como o `$1` do `pg` (Node) ou os `:named` do JPQL. É a forma correta de escrever SQL que o LINQ não exprime (aqui, o `ON CONFLICT`), sem abrir a porta a SQL injection.

## 7. RabbitMQ.Client v7: tudo assíncrono

```csharp
var connection = await factory.CreateConnectionAsync(ct);
var channel = await connection.CreateChannelAsync(cancellationToken: ct);
await channel.QueueDeclareAsync(...);
await channel.BasicConsumeAsync(Queue, autoAck: false, consumer, cancellationToken: ct);
```

Repara no sufixo `Async` em **tudo**, incluindo `BasicAckAsync`/`BasicNackAsync`. Até há poucas versões, a API do RabbitMQ.Client era síncrona (bloqueante). A versão 7 reescreveu-a para `Task`-based, para não bloquear threads enquanto espera a rede — o mesmo motivo de fundo que faz o Node usar `async/await` em tudo (módulo 01), agora explícito numa biblioteca .NET.

**Mesma disciplina das outras duas linguagens:**
- `ack` só depois do trabalho estar feito (nunca antes).
- Erro permanente (`MalformedEventException`) → `nack(requeue: false)` → Dead Letter Exchange própria (`notifications.dlx`) → `notifications.task-completed.dlq`.
- Erro transitório → `nack(requeue: true)`.
- Ligação perdida → sai com `Environment.Exit(1)`, e o Docker (`restart: unless-stopped`) reinicia com estado limpo — o mesmo padrão do worker (módulo 07), descoberto da mesma forma (a testar a sério, não por teoria).

## 8. Autenticação: o MESMO bug do Keycloak, pela 3ª vez

```csharp
options.Events = new JwtBearerEvents
{
    OnTokenValidated = context =>
    {
        var realmAccessJson = context.Principal?.FindFirst("realm_access")?.Value;
        var identity = (ClaimsIdentity)context.Principal!.Identity!;
        KeycloakRoleClaims.AddRealmRoles(identity, realmAccessJson);
        return Task.CompletedTask;
    },
};
```

O JwtBearer do .NET, tal como o Spring Security (módulo 18), **não sabe** por omissão que o Keycloak põe os papéis em `realm_access: { roles: [...] }`. Sem este código, `RequireRole("admin")` falhava sempre com 403, exatamente como aconteceu no Spring. Já é a terceira vez que este workshop tropeça na mesma integração, em três linguagens diferentes — o que devia dizer-te algo: **isto não é um bug de uma biblioteca, é uma particularidade do Keycloak que qualquer integração tem de tratar.**

Repara também na dualidade de URLs (módulo 15): `options.MetadataAddress` usa o endpoint **interno** (o único que o contentor alcança); `ValidIssuer` usa o **público** (o que aparece no "iss" do token, porque foi o browser que falou com o Keycloak).

## 9. Testes: três andares, como nos outros dois serviços

| Teste | Tipo | Infra necessária |
|---|---|---|
| `TaskEventParserTests` | unidade | nenhuma |
| `KeycloakRoleClaimsTests` | unidade | nenhuma — a mesma armadilha do Spring, testada isoladamente |
| `NotificationRepositoryIntegrationTests` | integração | Postgres real (`DATABASE_TEST_URL`), com a mesma guarda "o nome tem de conter test" dos outros serviços |

**Porque não um teste de endpoint HTTP com `WebApplicationFactory` (o equivalente ao `@WebMvcTest` do Spring)?** Seria o próximo passo natural, mas exige substituir o `DbContext` e remover o `BackgroundService` do RabbitMQ no host de teste — mais complexidade do que o tempo disponível aqui permitia fazer com confiança. Ficou como exercício (D13) em vez de ser entregue a half-funcionar.

## 10. Docker: o mesmo padrão, com tamanhos diferentes

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
...
RUN dotnet publish Notifications.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
COPY --from=build /out .
USER app   # as imagens oficiais já trazem este utilizador não-root
```

Multi-stage, como o Node, o React/Nginx e o Spring. Compara os tamanhos finais (`docker images | grep workshop`): o `notifications` (.NET) fica a meio caminho entre o `web` (Nginx, o mais pequeno) e o `api` (Node) — e bem mais pequeno do que o `activity` (JVM). Não é uma regra universal entre linguagens, é uma consequência de quanto runtime cada uma arrasta.

## 11. Porque RabbitMQ aqui, e não Kafka outra vez?

Já tens Kafka a correr no `activity` (módulo 17). Dar ao `notifications` o **mesmo exchange do worker** (RabbitMQ, `tasks`), mas um **binding diferente** (`task.completed` em vez de `task.*`), prova algo que a teoria do módulo 06 só descreve: **vários consumidores independentes, com propósitos diferentes, reagem ao mesmo exchange, sem se atrapalharem.** Também mantém este serviço mais leve (sem precisar de ligar a dois brokers), e dá-te uma terceira vez para veres o padrão de idempotência (`ON CONFLICT DO NOTHING`) a repetir-se — exatamente igual ao worker e ao `activity`, em três linguagens.

## 12. Exercícios

- **D13. `WebApplicationFactory`:** o teste de endpoint que ficou de fora na secção 9. Substitui o `DbContext` por EF Core InMemory e remove o `BackgroundService` do host de teste; simula um JWT com `AddAuthentication("Test").AddScheme<TestAuthHandler>(...)`.
- **D14. Outra rota:** `GET /api/notifications/by-user/{userId}`, só para admins, com uma query LINQ (`Where` + `OrderByDescending`).
- **D15. Refazer o worker (RabbitMQ, Node) em .NET:** mesma fila, mesma idempotência, mesmos testes de contrato. É o D12 do módulo 18 (Spring), agora para quem prefere C#.
- **D16. `dotnet watch`:** corre `dotnet watch run` dentro do contentor de build e edita um endpoint — compara com o `--watch` do Node (módulo 04) e o que falta ao `mvn` (Spring) para teres hot-reload equivalente.

## Prática: escreve tu

A mesma API de notas que escreveste em Node ([módulo 04](04-api-em-camadas.md#prática-escreve-tu)) e em Spring ([módulo 18](18-spring-boot.md#prática-escreve-tu)), agora com Minimal APIs do .NET. No fim, tens o mesmo contrato HTTP em três stacks, e o [dicionário da secção 2](#2-dicionário-node--spring--net) passa a ser código teu. O terceiro exercício é sobre a coisa que o .NET leva mais a sério do que os outros dois: os **tempos de vida** da injeção de dependências.

**Ficheiros:** `pratica/21-dotnet/` (`NotasEndpoints.cs`, `Servicos.cs`, `Diagnostico.cs`; o `Program.cs` já liga as três peças)

**Verificar:** `npm run verificar 21` (dentro de `pratica/`). Só um exercício: `npm run verificar 21 NotasTests`, `... 21 ValidacaoTests` ou `... 21 DiagnosticoTests`. Sem o SDK do .NET instalado, o verificador corre-o no contentor `mcr.microsoft.com/dotnet/sdk:10.0` (cerca de 1,3 GB na primeira vez).

Como no Java, o compilador do C# compila **tudo** antes de correr qualquer teste: deixa sempre o código num estado que compila.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Minimal APIs: a API de notas (≈40 min)

**Ficheiros:** `NotasEndpoints.cs` (rotas, record `Nota`, `NotasService`) e `Servicos.cs` (registar o serviço)

O mesmo contrato do módulo 18: `GET /api/notas`, `POST` (`201` + `Location`), `GET /api/notas/{id}` (`404` com `{"error": "Nota 99 não encontrada"}`), `PUT /api/notas/{id}/afixada` e `DELETE` (`204`). A nota tem também `criadaEm` (a hora em que foi criada), que vai ser importante no P3.

Uma diferença em relação ao Spring: com a restrição `{id:long}` na rota, `/api/notas/abc` **nem sequer corresponde** a uma rota, e a resposta é `404` antes de o teu código correr. No Spring, a rota correspondia e a conversão falhava (`400`). As duas escolhas são defensáveis; o importante é saber qual a tua ferramenta faz.

**Sintaxe que vais praticar:** `app.MapGroup(...)`, `MapGet/MapPost/MapPut/MapDelete`, restrições de rota (`{id:long}`), parâmetros de lambdas que vêm da rota, do corpo ou da DI, `Results.Ok/Created/NoContent/Json`, `record`, construtores primários (`class NotasService(IRelogio relogio)`), `ConcurrentDictionary`, `Interlocked.Increment`, `with`, o padrão `is { } nota`.

<details>
<summary>Pista</summary>

Numa Minimal API, o ASP.NET Core decide de onde vem cada parâmetro do lambda: um tipo registado na DI vem do contentor (`NotasService service`), um nome que está na rota vem da rota (`long id`), e um tipo complexo vem do corpo JSON (`NovaNota pedido`). Não precisas de anotações. Para o `404` com corpo, `Results.Json(new { error = "..." }, statusCode: 404)`.
</details>

<details>
<summary>Solução de referência (inclui o P2)</summary>

```csharp
using System.Collections.Concurrent;

namespace Pratica;

// O que a API devolve. A serialização JSON põe os nomes em camelCase: {"id", "titulo", "afixada", "criadaEm"}.
public record Nota(long Id, string Titulo, bool Afixada, DateTimeOffset CriadaEm);

// O corpo do POST. Titulo é string? porque pode faltar no JSON: o compilador obriga-nos a tratar o null.
public record NovaNota(string? Titulo);

// Construtor primário (C# 12): o IRelogio chega pelo construtor, injetado pelo contentor.
public sealed class NotasService(IRelogio relogio)
{
    private readonly ConcurrentDictionary<long, Nota> _notas = new();
    private long _ultimoId;

    public IEnumerable<Nota> Listar() => _notas.Values.OrderBy(n => n.Id);

    public Nota? Obter(long id) => _notas.GetValueOrDefault(id);

    public Nota Criar(string titulo)
    {
        // Interlocked: incremento atómico. Vários pedidos ao mesmo tempo nunca recebem o mesmo id.
        var nota = new Nota(Interlocked.Increment(ref _ultimoId), titulo, false, relogio.Agora());
        _notas[nota.Id] = nota;
        return nota;
    }

    public Nota? Afixar(long id)
    {
        if (Obter(id) is not { } nota) return null;
        var afixada = nota with { Afixada = true }; // `with`: uma cópia do record com um campo mudado
        _notas[id] = afixada;
        return afixada;
    }

    public bool Apagar(long id) => _notas.TryRemove(id, out _);
}

public static class NotasEndpoints
{
    // Mensagem de erro no formato das outras duas APIs do workshop.
    static IResult Erro(int status, string mensagem) => Results.Json(new { error = mensagem }, statusCode: status);

    static IResult NaoEncontrada(long id) => Erro(StatusCodes.Status404NotFound, $"Nota {id} não encontrada");

    public static void Mapear(WebApplication app)
    {
        // Um grupo: todas as rotas abaixo começam por /api/notas.
        var notas = app.MapGroup("/api/notas");

        // Os parâmetros dos lambdas vêm de sítios diferentes, e o ASP.NET Core deduz de onde:
        // NotasService do contentor de DI, long id da rota, NovaNota do corpo JSON.
        notas.MapGet("/", (NotasService service) => service.Listar());

        notas.MapGet("/{id:long}", (long id, NotasService service) =>
            service.Obter(id) is { } nota ? Results.Ok(nota) : NaoEncontrada(id));

        notas.MapPost("/", (NovaNota pedido, NotasService service) =>
        {
            var titulo = pedido.Titulo?.Trim();
            if (string.IsNullOrEmpty(titulo)) return Erro(StatusCodes.Status400BadRequest, "O título é obrigatório");
            if (titulo.Length > 120) return Erro(StatusCodes.Status400BadRequest, "Máximo de 120 caracteres");

            var nota = service.Criar(titulo);
            return Results.Created($"/api/notas/{nota.Id}", nota);
        });

        notas.MapPut("/{id:long}/afixada", (long id, NotasService service) =>
            service.Afixar(id) is { } nota ? Results.Ok(nota) : NaoEncontrada(id));

        notas.MapDelete("/{id:long}", (long id, NotasService service) =>
            service.Apagar(id) ? Results.NoContent() : NaoEncontrada(id));
    }
}
```
</details>

### P2 · Validação, com as mesmas mensagens das outras duas APIs (≈15 min)

**Ficheiro:** `NotasEndpoints.cs` (o `MapPost`)

Título em falta, `null` ou só espaços: `400` com `{"error": "O título é obrigatório"}`. Mais de 120 caracteres: `{"error": "Máximo de 120 caracteres"}`. E o título guarda-se sem espaços nas pontas.

Aqui não há anotações nem `@Valid`: a validação é código normal, no endpoint. É uma escolha, e não a única: o .NET também tem validação por atributos e bibliotecas como o FluentValidation. Para três regras, um `if` por regra é o mais fácil de ler.

**Sintaxe que vais praticar:** `string?` e o operador `?.` (`pedido.Titulo?.Trim()`), `string.IsNullOrEmpty`, `return` antecipado num lambda com vários tipos de resultado.

### P3 · Injeção de dependências: trocar peças e tempos de vida (≈35 min)

**Ficheiros:** `Servicos.cs` e `Diagnostico.cs` (o `IRelogio` já está declarado)

Duas partes:

1. **Trocar uma dependência num teste.** O `NotasService` passa a receber um `IRelogio` pelo construtor, em vez de chamar `DateTimeOffset.UtcNow`. O teste substitui-o por um relógio parado (`ConfigureTestServices`) e confirma que a nota guarda essa hora. É o mesmo `clock` injetado do módulo 04, agora com um contentor de DI a fazer a ligação.
2. **Tempos de vida.** Um middleware põe o cabeçalho `X-Request-Id` em cada resposta, e a rota `GET /api/diagnostico` devolve `{ pedidoId, totalPedidos }`. O teste exige que:
   - cada pedido tenha um id **diferente** (por isso o serviço que o guarda **não** pode ser *Singleton*);
   - o middleware e a rota vejam **o mesmo** id dentro do mesmo pedido (por isso **não** pode ser *Transient*);
   - o `totalPedidos` conte **todos** os pedidos da aplicação (por isso esse **é** *Singleton*).

   A única combinação que passa é a certa: *Scoped* para o id do pedido, *Singleton* para o contador.

**Sintaxe que vais praticar:** `AddSingleton/AddScoped`, interfaces (`IRelogio`), `app.Use(async (context, next) => ...)`, `context.RequestServices.GetRequiredService<T>()`, `context.Response.Headers[...]`, propriedades só de leitura (`{ get; } = Guid.NewGuid().ToString()`), `Interlocked`/`Volatile`.

<details>
<summary>Pista</summary>

Dentro de um middleware, um serviço *Scoped* pede-se ao contentor **do pedido**: `context.RequestServices`. Se o pedires ao `app.Services` (o contentor da aplicação), recebes outra instância, ou um erro. E pensa no que aconteceria com um contador num serviço *Scoped*: começava do zero em cada pedido.
</details>

<details>
<summary>Solução de referência</summary>

```csharp
// Servicos.cs
namespace Pratica;

public static class Servicos
{
    public static void Registar(IServiceCollection services)
    {
        // Singleton: UMA instância para a aplicação inteira. Serve para o que tem estado partilhado
        // (as notas, o contador) ou não tem estado nenhum (o relógio).
        services.AddSingleton<IRelogio, RelogioDoSistema>();
        services.AddSingleton<NotasService>();
        services.AddSingleton<ContadorDePedidos>();

        // Scoped: uma instância POR PEDIDO HTTP, partilhada por todos os que a pedirem durante esse pedido.
        services.AddScoped<ContextoDoPedido>();
    }
}

public sealed class RelogioDoSistema : IRelogio
{
    public DateTimeOffset Agora() => DateTimeOffset.UtcNow;
}
```

```csharp
// Diagnostico.cs
namespace Pratica;

public interface IRelogio
{
    DateTimeOffset Agora();
}

// Scoped: criado no início de cada pedido. O Guid é gerado uma vez, no construtor.
public sealed class ContextoDoPedido
{
    public string PedidoId { get; } = Guid.NewGuid().ToString();
}

// Singleton: um só para a aplicação toda, por isso o incremento tem de ser seguro entre threads.
public sealed class ContadorDePedidos
{
    private int _total;
    public int Incrementar() => Interlocked.Increment(ref _total);
    public int Total => Volatile.Read(ref _total);
}

public static class Diagnostico
{
    public static void Configurar(WebApplication app)
    {
        // Middleware inline: corre em todos os pedidos, antes das rotas.
        // Os serviços scoped pedem-se ao contentor DO PEDIDO (context.RequestServices).
        app.Use(async (context, next) =>
        {
            var pedido = context.RequestServices.GetRequiredService<ContextoDoPedido>();
            context.RequestServices.GetRequiredService<ContadorDePedidos>().Incrementar();
            context.Response.Headers["X-Request-Id"] = pedido.PedidoId;
            await next(context);
        });

        // A rota recebe o MESMO ContextoDoPedido que o middleware usou (scoped = um por pedido).
        app.MapGet("/api/diagnostico", (ContextoDoPedido pedido, ContadorDePedidos contador) =>
            new { pedidoId = pedido.PedidoId, totalPedidos = contador.Total });
    }
}
```

O erro clássico de tempos de vida, que o .NET deteta no arranque em modo de desenvolvimento: um *Singleton* que recebe um *Scoped* pelo construtor. O singleton vive para sempre, por isso ficaria agarrado à instância do primeiro pedido (e, se fosse um `DbContext` do EF Core, a uma ligação à BD que já foi fechada). É por isso que o `ContadorDePedidos` não recebe o `ContextoDoPedido`: é o middleware que usa os dois.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 21`.

**1.** No .NET, onde vive a injeção de dependências usada neste workshop?

- a) Numa biblioteca externa que se escolhe (como o Spring)
- b) É nativa do próprio SDK/plataforma, sem framework adicional
- c) Escrita à mão, como no index.js (Node)
- d) Não existe DI em .NET

<details><summary>Resposta</summary>

**b) É nativa do próprio SDK/plataforma, sem framework adicional** — Ao contrário do Spring (framework) ou do Node (manual), a DI está embutida na plataforma .NET.

</details>

**2.** Porque é que o RabbitMqConsumer pede um IServiceScopeFactory em vez de um NotificationsDbContext diretamente?

- a) Por estilo de código, sem efeito prático
- b) O DbContext é Scoped (uma instância por operação); um BackgroundService vive para sempre, por isso cria um scope novo por mensagem
- c) IServiceScopeFactory é mais rápido
- d) O RabbitMQ exige esse tipo

<details><summary>Resposta</summary>

**b) O DbContext é Scoped (uma instância por operação); um BackgroundService vive para sempre, por isso cria um scope novo por mensagem** — Sem isto, todas as mensagens partilhariam a mesma instância de DbContext, o que corrompe o estado interno do EF Core.

</details>

**3.** O que é 'ExecuteSqlInterpolatedAsync', usado para o INSERT ... ON CONFLICT?

- a) Concatenação de strings, tal como um SQL injection comum
- b) Interpolação do C# que o EF Core transforma em parâmetros reais — tão seguro como o $1 do pg (Node) ou o :named do JPQL
- c) Uma função só para SELECTs
- d) Está descontinuada no EF Core 10

<details><summary>Resposta</summary>

**b) Interpolação do C# que o EF Core transforma em parâmetros reais — tão seguro como o $1 do pg (Node) ou o :named do JPQL** — Parece concatenação, mas cada {valor} vira um parâmetro, nunca texto inserido diretamente no SQL.

</details>

**4.** Que tipo de API do ASP.NET Core este serviço usa, que define rotas como funções (app.MapGet) em vez de classes Controller?

<details><summary>Resposta</summary>

**minimal api** — Minimal APIs: menos cerimónia, ideal para microserviços pequenos como este.

</details>

**5.** O que é que o módulo chama 'o mesmo bug do Keycloak, pela 3ª vez'?

- a) Um erro de configuração do Postgres
- b) O JwtBearer não lê 'realm_access.roles' como papéis por omissão — a mesma armadilha já vista no Spring (módulo 17)
- c) Um erro de compilação do C#
- d) Uma falha de rede do RabbitMQ

<details><summary>Resposta</summary>

**b) O JwtBearer não lê 'realm_access.roles' como papéis por omissão — a mesma armadilha já vista no Spring (módulo 17)** — KeycloakRoleClaims.AddRealmRoles resolve exatamente o mesmo problema que KeycloakRealmRoles resolveu em Java.

</details>

<!-- quiz:end -->
