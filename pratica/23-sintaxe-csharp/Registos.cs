namespace Sintaxe;

// P1 · Records, nullable, interpolação e strings em bruto (ver docs/23-sintaxe-csharp.md, "Prática").
// O record já está declarado; escreve o corpo dos três métodos.
public record Morada(string Rua, string Cidade, string? CodigoPostal);

public static class Registos
{
    // "Rua Augusta 10, Lisboa (1100-053)", ou "Rua Augusta 10, Lisboa" se não houver código postal.
    public static string Formatar(Morada morada) => throw new NotImplementedException("Por fazer: P1");

    // Uma CÓPIA da morada com outra cidade e sem código postal (o antigo deixa de fazer sentido).
    // A original não muda (os records são imutáveis).
    public static Morada MudarDeCidade(Morada morada, string novaCidade) => throw new NotImplementedException("Por fazer: P1");

    // JSON escrito à mão com uma raw string interpolada, ex.: { "nome": "Ana", "idade": 30 }
    // (exatamente este formato: chaves, aspas e espaços como no exemplo).
    public static string ParaJson(string nome, int idade) => throw new NotImplementedException("Por fazer: P1");

    // O primeiro nome em maiúsculas, ou "ANÓNIMO" se o nome for null ou só espaços.
    public static string PrimeiroNome(string? nomeCompleto) => throw new NotImplementedException("Por fazer: P1");
}
