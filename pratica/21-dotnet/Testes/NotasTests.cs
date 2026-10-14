using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Pratica.Testes;

// P1 · A API de notas, testada por HTTP. O WebApplicationFactory arranca a aplicação inteira em
// memória (sem abrir uma porta de rede) e dá um HttpClient que fala com ela.
// Cada teste cria a sua fábrica, ou seja, uma aplicação nova, sem notas e com ids desde 1.
public class NotasTests
{
    static HttpClient NovoCliente() => new WebApplicationFactory<Program>().CreateClient();

    static Task<HttpResponseMessage> Criar(HttpClient c, string titulo) =>
        c.PostAsJsonAsync("/api/notas", new { titulo });

    [Fact]
    public async Task ComecaSemNotas()
    {
        var resposta = await NovoCliente().GetAsync("/api/notas");
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal(0, (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength());
    }

    [Fact]
    public async Task CriarDevolve201ComALocalizacao()
    {
        var resposta = await Criar(NovoCliente(), "Estudar .NET");
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Equal("/api/notas/1", resposta.Headers.Location?.ToString());

        var nota = await resposta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, nota.GetProperty("id").GetInt64());
        Assert.Equal("Estudar .NET", nota.GetProperty("titulo").GetString());
        Assert.False(nota.GetProperty("afixada").GetBoolean());
    }

    [Fact]
    public async Task ListarPelaOrdemDeCriacao()
    {
        var c = NovoCliente();
        await Criar(c, "Primeira");
        await Criar(c, "Segunda");
        var notas = await c.GetFromJsonAsync<JsonElement>("/api/notas");
        Assert.Equal(new[] { "Primeira", "Segunda" }, notas.EnumerateArray().Select(n => n.GetProperty("titulo").GetString()));
    }

    [Fact]
    public async Task ObterPeloIdOu404ComAMensagem()
    {
        var c = NovoCliente();
        await Criar(c, "Estudar .NET");
        var nota = await c.GetFromJsonAsync<JsonElement>("/api/notas/1");
        Assert.Equal("Estudar .NET", nota.GetProperty("titulo").GetString());

        var naoExiste = await c.GetAsync("/api/notas/99");
        Assert.Equal(HttpStatusCode.NotFound, naoExiste.StatusCode);
        var erro = await naoExiste.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Nota 99 não encontrada", erro.GetProperty("error").GetString());
    }

    [Fact]
    public async Task AfixarUmaNota()
    {
        var c = NovoCliente();
        await Criar(c, "Importante");
        var resposta = await c.PutAsync("/api/notas/1/afixada", null);
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.True((await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("afixada").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync("/api/notas/99/afixada", null)).StatusCode);
    }

    [Fact]
    public async Task ApagarDevolve204EDepoisJaNaoExiste()
    {
        var c = NovoCliente();
        await Criar(c, "Temporária");
        var resposta = await c.DeleteAsync("/api/notas/1");
        Assert.Equal(HttpStatusCode.NoContent, resposta.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/notas/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.DeleteAsync("/api/notas/1")).StatusCode);
    }

    [Fact]
    public async Task UmIdQueNaoENumeroNemSequerCorrespondeARota()
    {
        var c = NovoCliente();
        Assert.Equal(HttpStatusCode.Created, (await Criar(c, "Existe")).StatusCode); // a API existe...
        // ...mas com a restrição {id:long} na rota, "abc" não corresponde a nenhuma rota: 404, antes do teu código.
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/notas/abc")).StatusCode);
    }
}
