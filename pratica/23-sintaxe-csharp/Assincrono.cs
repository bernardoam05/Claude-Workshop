using System.Runtime.CompilerServices;

namespace Sintaxe;

// P4 · async/await, Task e genéricos (ver docs/23-sintaxe-csharp.md, "Prática").
public static class Assincrono
{
    // Carrega todos os ids EM PARALELO (não um de cada vez) e devolve os resultados pela ordem dos ids.
    public static Task<TResultado[]> CarregarTodos<TResultado>(IEnumerable<int> ids, Func<int, Task<TResultado>> carregar) =>
        throw new NotImplementedException("Por fazer: P4");

    // Espera pela tarefa no máximo `limite`. Se acabar a tempo, devolve o resultado; se não, devolve `porOmissao`.
    public static Task<T> ComLimiteDeTempo<T>(Task<T> tarefa, TimeSpan limite, T porOmissao) =>
        throw new NotImplementedException("Por fazer: P4");

    // Produz 1, 2, 3... até `ate`, com uma pausa de `pausa` entre cada um, e para assim que o
    // token for cancelado (sem lançar exceção: simplesmente deixa de produzir).
    public static async IAsyncEnumerable<int> Contar(int ate, TimeSpan pausa, [EnumeratorCancellation] CancellationToken token = default)
    {
        await Task.CompletedTask;
        throw new NotImplementedException("Por fazer: P4");
#pragma warning disable CS0162 // código inalcançável: só existe para isto compilar como um iterador
        yield break;
#pragma warning restore CS0162
    }
}
