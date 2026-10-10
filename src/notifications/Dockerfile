# Multi-stage, o mesmo padrão do web, do worker e do activity: o SDK (compilador, +500MB)
# só existe no estágio de build; a imagem final só tem o runtime ASP.NET Core + o binário publicado.

# Estágio 1: compilar e publicar.
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /app
# Primeiro só os ficheiros de projeto: a mesma ideia do package.json antes do src/ nos outros
# serviços — "dotnet restore" só volta a correr se as dependências mudarem.
COPY Notifications.csproj ./
RUN dotnet restore
COPY . .
# Os testes correm no CI (job "notifications"), não aqui: aqui só se empacota.
RUN dotnet publish Notifications.csproj -c Release -o /out --no-restore

# Estágio 2: só o runtime ASP.NET Core (sem SDK, sem código-fonte).
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /out .

# As imagens oficiais já vêm com um utilizador não-root chamado "app" — menor privilégio,
# sem termos de o criar à mão (ao contrário da imagem Java, que não o tem).
USER app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Notifications.dll"]
