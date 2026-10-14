using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Pratica.Testes;

// P2 · Validação, com as MESMAS mensagens e o mesmo formato da API Node e do Spring do módulo 18.
public class ValidacaoTests
{
    static HttpClient NovoCliente() => new WebApplicationFactory<Program>().CreateClient();

    static async Task<string?> Erro(HttpResponseMessage resposta)
    {
        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        return (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString();
    }

    [Fact]
    public async Task TituloEmFaltaNuloOuEmBranco()
    {
        var c = NovoCliente();
        Assert.Equal("O título é obrigatório", await Erro(await c.PostAsJsonAsync("/api/notas", new { })));
        Assert.Equal("O título é obrigatório", await Erro(await c.PostAsJsonAsync("/api/notas", new { titulo = (string?)null })));
        Assert.Equal("O título é obrigatório", await Erro(await c.PostAsJsonAsync("/api/notas", new { titulo = "   " })));
    }

    [Fact]
    public async Task TituloComprido()
    {
        var resposta = await NovoCliente().PostAsJsonAsync("/api/notas", new { titulo = new string('x', 121) });
        Assert.Equal("Máximo de 120 caracteres", await Erro(resposta));
    }

    [Fact]
    public async Task OTituloFicaGuardadoSemEspacosNasPontas()
    {
        var resposta = await NovoCliente().PostAsJsonAsync("/api/notas", new { titulo = "  Limpo  " });
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.Equal("Limpo", (await resposta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("titulo").GetString());
    }
}
