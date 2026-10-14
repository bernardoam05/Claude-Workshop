using Xunit;

namespace Sintaxe.Testes;

public class RegistosTests
{
    static readonly Morada Lisboa = new("Rua Augusta 10", "Lisboa", "1100-053");

    [Fact]
    public void FormatarComESemCodigoPostal()
    {
        Assert.Equal("Rua Augusta 10, Lisboa (1100-053)", Registos.Formatar(Lisboa));
        Assert.Equal("Rua Augusta 10, Lisboa", Registos.Formatar(Lisboa with { CodigoPostal = null }));
    }

    [Fact]
    public void MudarDeCidadeDevolveUmaCopiaSemMexerNaOriginal()
    {
        var porto = Registos.MudarDeCidade(Lisboa, "Porto");
        Assert.Equal(new Morada("Rua Augusta 10", "Porto", null), porto); // records comparam-se pelos valores
        Assert.Equal("Lisboa", Lisboa.Cidade);
    }

    [Fact]
    public void ParaJsonComUmaRawString()
    {
        Assert.Equal("{ \"nome\": \"Ana\", \"idade\": 30 }", Registos.ParaJson("Ana", 30));
    }

    [Theory]
    [InlineData("ana maria silva", "ANA")]
    [InlineData("  Bruno  ", "BRUNO")]
    [InlineData("", "ANÓNIMO")]
    [InlineData("   ", "ANÓNIMO")]
    [InlineData(null, "ANÓNIMO")]
    public void PrimeiroNome(string? nome, string esperado)
    {
        Assert.Equal(esperado, Registos.PrimeiroNome(nome));
    }
}
