using Xunit;

namespace Sintaxe.Testes;

public class ConsultasTests
{
    static readonly List<Tarefa> Tarefas =
    [
        new(1, "Escrever capítulo", false, "Mestrado", 120),
        new(2, "Ler artigo", true, "Mestrado", 45),
        new(3, "Pagar a luz", false, "Casa", 10),
        new(4, "Aspirar", true, "Casa", 30),
        new(5, "Treino", true, "Ginásio", 60),
        new(6, "Enviar resumo", false, "Mestrado", 20),
    ];

    [Fact]
    public void TitulosPorFazerPorOrdemAlfabetica() =>
        Assert.Equal(["Enviar resumo", "Escrever capítulo", "Pagar a luz"], Consultas.TitulosPorFazer(Tarefas));

    [Fact]
    public void MinutosPorProjeto()
    {
        var minutos = Consultas.MinutosPorProjeto(Tarefas);
        Assert.Equal(185, minutos["Mestrado"]);
        Assert.Equal(40, minutos["Casa"]);
        Assert.Equal(60, minutos["Ginásio"]);
        Assert.Equal(3, minutos.Count);
    }

    [Fact]
    public void ProjetoMaisAtrasado()
    {
        Assert.Equal("Mestrado", Consultas.ProjetoMaisAtrasado(Tarefas));
        Assert.Null(Consultas.ProjetoMaisAtrasado(Tarefas.Where(t => t.Feita)));
    }

    [Fact]
    public void ProjetoConcluido()
    {
        Assert.True(Consultas.ProjetoConcluido(Tarefas, "Ginásio"));
        Assert.False(Consultas.ProjetoConcluido(Tarefas, "Casa"));
        Assert.False(Consultas.ProjetoConcluido(Tarefas, "Inexistente")); // sem tarefas não está "concluído"
    }

    [Fact]
    public void Pagina()
    {
        var desordenadas = Tarefas.OrderByDescending(t => t.Id);
        Assert.Equal([3, 4], Consultas.Pagina(desordenadas, 2, 2).Select(t => t.Id));
        Assert.Empty(Consultas.Pagina(desordenadas, 4, 2));
    }
}
