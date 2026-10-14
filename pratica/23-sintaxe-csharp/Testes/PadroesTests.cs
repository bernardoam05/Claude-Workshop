using Xunit;

namespace Sintaxe.Testes;

public class PadroesTests
{
    public static TheoryData<object?, string> Casos => new()
    {
        { null, "nada" },
        { -5, "negativo" },
        { 0, "zero" },
        { 42, "positivo" },
        { "", "texto vazio" },
        { "olá", "texto com 3 caracteres" },
        { Array.Empty<int>(), "lista vazia" },
        { new[] { 7 }, "só o 7" },
        { new[] { 1, 2 }, "de 1 a 2" },
        { new[] { 3, 9, 4, 8 }, "de 3 a 8" },
        { 3.14, "desconhecido" },
        { new[] { "a" }, "desconhecido" },
    };

    [Theory]
    [MemberData(nameof(Casos))]
    public void Classificar(object? valor, string esperado) => Assert.Equal(esperado, Padroes.Classificar(valor));
}
