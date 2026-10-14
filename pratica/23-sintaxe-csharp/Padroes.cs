namespace Sintaxe;

// P3 · Pattern matching com um switch expression (ver docs/23-sintaxe-csharp.md, "Prática").
public static class Padroes
{
    // Escreve UM switch expression (valor switch { ... }) que devolve:
    //   null                         → "nada"
    //   um int negativo              → "negativo"
    //   o int 0                      → "zero"
    //   outro int                    → "positivo"
    //   uma string vazia             → "texto vazio"
    //   outra string                 → "texto com N caracteres"
    //   um int[] vazio               → "lista vazia"
    //   um int[] com um elemento     → "só o X"
    //   um int[] com dois ou mais    → "de PRIMEIRO a ÚLTIMO"
    //   qualquer outra coisa         → "desconhecido"
    public static string Classificar(object? valor) => throw new NotImplementedException("Por fazer: P3");
}
