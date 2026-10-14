using System.Runtime.CompilerServices;

namespace Pratica.Testes;

// Já feito. O WebApplicationFactory procura a pasta da aplicação a partir de um ficheiro .sln, o que
// pressupõe testes num projeto à parte. Aqui está tudo no mesmo projeto, por isso dizemos-lhe a
// pasta diretamente, pela variável que ele consulta primeiro. [ModuleInitializer] corre antes de tudo.
static class ConfiguracaoDosTestes
{
    [ModuleInitializer]
    internal static void Iniciar() =>
        Environment.SetEnvironmentVariable("ASPNETCORE_TEST_CONTENTROOT_PRATICA", AppContext.BaseDirectory);
}
