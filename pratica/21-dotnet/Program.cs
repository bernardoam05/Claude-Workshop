// Já feito: o arranque da aplicação. Chama as tuas três peças, por esta ordem.
using Pratica;

var builder = WebApplication.CreateBuilder(args);
Servicos.Registar(builder.Services);   // P1 e P3: o que vai para o contentor de injeção de dependências

var app = builder.Build();
Diagnostico.Configurar(app);           // P3: o middleware e a rota /api/diagnostico
NotasEndpoints.Mapear(app);            // P1 e P2: as rotas /api/notas

app.Run();

// Os testes (WebApplicationFactory<Program>) precisam de ver esta classe.
public partial class Program;
