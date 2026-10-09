# Multi-stage, como no web e no worker: o Maven e o JDK só existem no estágio de build.

# Estágio 1: compilar com Maven + JDK 21.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Primeiro só o pom.xml: as dependências ficam numa camada em cache enquanto o pom não mudar
# (a mesma ideia do package.json antes do src/ nos Dockerfiles do Node).
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
# Os testes correm no CI (job "activity"); aqui só se empacota.
RUN mvn -B -q package -DskipTests

# Estágio 2: só o JRE (sem compilador) + o JAR.
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/target/activity-1.0.0.jar app.jar
USER app
EXPOSE 8080
# MaxRAMPercentage: a JVM respeita o limite de memória do contentor em vez da memória total da máquina.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
