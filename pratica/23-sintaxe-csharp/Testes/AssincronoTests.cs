using System.Diagnostics;
using Xunit;

namespace Sintaxe.Testes;

public class AssincronoTests
{
    [Fact]
    public async Task CarregarTodosEmParaleloEPelaOrdem()
    {
        var relogio = Stopwatch.StartNew();
        var resultados = await Assincrono.CarregarTodos([1, 2, 3, 4, 5], async id =>
        {
            await Task.Delay(id == 1 ? 150 : 50); // o primeiro é o mais lento
            return $"item {id}";
        });
        Assert.Equal(["item 1", "item 2", "item 3", "item 4", "item 5"], resultados);
        // Um de cada vez seriam 150 + 4 × 50 = 350 ms; em paralelo, ~150 ms.
        Assert.True(relogio.ElapsedMilliseconds < 300, $"demorou {relogio.ElapsedMilliseconds} ms: foram carregados um de cada vez?");
    }

    [Fact]
    public async Task ComLimiteDeTempo()
    {
        Assert.Equal(42, await Assincrono.ComLimiteDeTempo(Task.FromResult(42), TimeSpan.FromSeconds(1), -1));

        var lenta = Task.Delay(1000).ContinueWith(_ => 42);
        var relogio = Stopwatch.StartNew();
        Assert.Equal(-1, await Assincrono.ComLimiteDeTempo(lenta, TimeSpan.FromMilliseconds(50), -1));
        Assert.True(relogio.ElapsedMilliseconds < 500, "não pode ficar à espera da tarefa lenta");
    }

    [Fact]
    public async Task ContarProduzOsNumerosComAwaitForeach()
    {
        var vistos = new List<int>();
        await foreach (var n in Assincrono.Contar(4, TimeSpan.FromMilliseconds(1)))
        {
            vistos.Add(n);
        }
        Assert.Equal([1, 2, 3, 4], vistos);
    }

    [Fact]
    public async Task ContarParaQuandoOTokenECancelado()
    {
        using var cancelamento = new CancellationTokenSource();
        var vistos = new List<int>();
        await foreach (var n in Assincrono.Contar(1000, TimeSpan.FromMilliseconds(5), cancelamento.Token))
        {
            vistos.Add(n);
            if (n == 3) cancelamento.Cancel();
        }
        Assert.Equal([1, 2, 3], vistos);
    }
}
