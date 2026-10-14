namespace Pratica;

// P3 · Já feito: o contrato do relógio. A tua NotasService passa a recebê-lo pelo construtor,
// e os testes trocam-no por um relógio parado.
public interface IRelogio
{
    DateTimeOffset Agora();
}

// P3 · O middleware do X-Request-Id e a rota /api/diagnostico (ver docs/21-dotnet.md, "Prática").
public static class Diagnostico
{
    public static void Configurar(WebApplication app)
    {
        // Por fazer.
    }
}
