using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Pratica.Testes;

// P3 · Injeção de dependências: trocar uma dependência num teste, e os três tempos de vida.
public class DiagnosticoTests
{
    // Um relógio parado: o teste sabe exatamente que hora a aplicação vai ver.
    sealed class RelogioParado(DateTimeOffset instante) : IRelogio
    {
        public DateTimeOffset Agora() => instante;
    }

    [Fact]
    public async Task ANotaGuardaAHoraDoRelogioInjetado()
    {
        var instante = new DateTimeOffset(2026, 10, 14, 9, 30, 0, TimeSpan.Zero);
        // WithWebHostBuilder + ConfigureTestServices: a aplicação é a mesma, só esta peça muda.
        var c = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IRelogio>(new RelogioParado(instante))))
            .CreateClient();

        var nota = await (await c.PostAsJsonAsync("/api/notas", new { titulo = "Com hora" })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(instante, nota.GetProperty("criadaEm").GetDateTimeOffset());
    }

    [Fact]
    public async Task CadaPedidoTemUmIdProprioQueEOMesmoNoMiddlewareENaRota()
    {
        var c = new WebApplicationFactory<Program>().CreateClient();

        var r1 = await c.GetAsync("/api/diagnostico");
        var r2 = await c.GetAsync("/api/diagnostico");
        var id1 = r1.Headers.GetValues("X-Request-Id").Single();
        var id2 = r2.Headers.GetValues("X-Request-Id").Single();

        Assert.True(Guid.TryParse(id1, out _), "o X-Request-Id deve ser um GUID");
        Assert.NotEqual(id1, id2); // um por pedido: não é Singleton
        // O middleware e a rota receberam a MESMA instância dentro do mesmo pedido: não é Transient.
        Assert.Equal(id1, (await r1.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("pedidoId").GetString());
    }

    [Fact]
    public async Task OContadorDePedidosEPartilhadoPorTodosOsPedidos()
    {
        var c = new WebApplicationFactory<Program>().CreateClient();
        await c.GetAsync("/api/notas");
        await c.GetAsync("/api/notas");
        var diag = await c.GetFromJsonAsync<JsonElement>("/api/diagnostico");
        Assert.Equal(3, diag.GetProperty("totalPedidos").GetInt32()); // os dois anteriores + este
    }
}
