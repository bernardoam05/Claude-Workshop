namespace Sintaxe;

// P2 · LINQ (ver docs/23-sintaxe-csharp.md, "Prática"). Cada método é UMA expressão LINQ.
public record Tarefa(int Id, string Titulo, bool Feita, string Projeto, int Minutos);

public static class Consultas
{
    // Títulos das tarefas por fazer, por ordem alfabética.
    public static List<string> TitulosPorFazer(IEnumerable<Tarefa> tarefas) => throw new NotImplementedException("Por fazer: P2");

    // Projeto → soma dos minutos de TODAS as suas tarefas.
    public static Dictionary<string, int> MinutosPorProjeto(IEnumerable<Tarefa> tarefas) => throw new NotImplementedException("Por fazer: P2");

    // O projeto com mais minutos POR FAZER; null se não houver nada por fazer.
    public static string? ProjetoMaisAtrasado(IEnumerable<Tarefa> tarefas) => throw new NotImplementedException("Por fazer: P2");

    // true se o projeto tiver pelo menos uma tarefa e estiverem todas feitas.
    public static bool ProjetoConcluido(IEnumerable<Tarefa> tarefas, string projeto) => throw new NotImplementedException("Por fazer: P2");

    // A página `pagina` (começa em 1) de `tamanho` tarefas, por ordem de Id.
    public static List<Tarefa> Pagina(IEnumerable<Tarefa> tarefas, int pagina, int tamanho) => throw new NotImplementedException("Por fazer: P2");
}
