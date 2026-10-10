# 18 · Java e Spring Boot

**Objetivo:** ler e escrever um microserviço Spring Boot como os que vais encontrar na maioria das empresas em Portugal, e perceber como cada peça corresponde ao que já fizeste em Node.

**Código:** `src/activity/`. Lê por esta ordem: `pom.xml` → `application.yml` → `ActivityApplication.java` → `events/` → `activity/` → `config/` → testes em `src/test/`.

---

## 1. O que este serviço faz

- **Consome** o tópico Kafka `task-events` (módulo 17).
- **Guarda** cada evento no schema `activity` do Postgres, de forma idempotente.
- **Expõe** `GET /api/activity/summary` e `GET /api/activity/recent`, só para utilizadores com o papel `admin` no Keycloak.
- **Publica métricas** em `/actuator/prometheus` (módulo 19).

Experimenta: faz login com `carla` / `carla-password` (tem o papel admin) e com `alice` (não tem), e chama a rota. Ou corre `./scripts/smoke-test.sh`, que testa os dois.

## 2. Dicionário Node → Spring

| Conceito | No projeto Node | No Spring Boot |
|---|---|---|
| Gestor de dependências | `package.json` + npm | `pom.xml` + Maven (ou Gradle) |
| Ponto de composição | `index.js` (liga as peças à mão) | contentor de **injeção de dependências** (o Spring liga-as) |
| Configuração | `config.js` + `process.env` | `application.yml` + `${VAR:omissão}` |
| Rotas | `routes/tasks.js` | `@RestController` + `@GetMapping` |
| Lógica de negócio | `services/taskService.js` | `@Service` |
| Acesso a dados (SQL à mão) | `repositories/taskRepository.js` | `JpaRepository` (Spring Data JPA + Hibernate) |
| Migrações | `migrate.js` + `.sql` | **Flyway** + `db/migration/V1__....sql` |
| Transação | `BEGIN`/`COMMIT` à mão | `@Transactional` |
| Validar JWT | `oidcVerifier.js` (jose) | `spring-boot-starter-oauth2-resource-server` + 3 linhas de YAML |
| Middleware de auth | `middleware/auth.js` | `SecurityFilterChain` |
| Autorização | `WHERE user_id = $1` | `@PreAuthorize("hasRole('admin')")` |
| Consumidor de mensagens | `worker/src/index.ts` | `@KafkaListener` |
| Health checks | `/api/health` escrito à mão | **Actuator** `/actuator/health/readiness` |
| Métricas | `prom-client` | **Micrometer** (vem com o Actuator) |
| Testes | `node:test` + fakes | JUnit 5 + Mockito + AssertJ + MockMvc |

A grande diferença: em Node escreveste a ligação das peças à mão; em Spring, declaras e o framework liga. Isso poupa código mas esconde coisas. Quando algo não funciona, o problema está muitas vezes numa **auto-configuração** que não percebeste.

## 3. Injeção de dependências

```java
@Service
public class ActivityService {
    private final ActivityEventRepository repository;
    private final MeterRegistry meterRegistry;

    public ActivityService(ActivityEventRepository repository, MeterRegistry meterRegistry) { ... }
}
```

Não há `new ActivityService(...)` em lado nenhum. No arranque, o Spring:
1. procura classes anotadas (`@Service`, `@Component`, `@RestController`, `@Configuration`);
2. vê o que cada construtor pede;
3. cria as peças pela ordem certa e passa-as (os "beans").

Usa sempre **injeção por construtor** (campos `final`), não `@Autowired` em campos. É testável sem Spring (os testes do `ActivityService` fazem `new ActivityService(mock, registry)`) e torna as dependências óbvias.

## 4. Auto-configuração: a "magia"

Puseste `spring-kafka` no `pom.xml` e `spring.kafka.bootstrap-servers` no YAML? O Spring cria sozinho um `KafkaTemplate`, uma fábrica de consumidores e liga o `@KafkaListener`. O mesmo para JPA, segurança e Actuator.

Para ver o que foi configurado e porquê: arranca com `--debug` (ou `logging.level.org.springframework.boot.autoconfigure=DEBUG`) e lê o *Conditions Evaluation Report*. É a ferramenta para "porque é que isto não está a funcionar?".

## 5. JPA, Hibernate e Spring Data

- **JPA** é a especificação (anotações `@Entity`, `@Id`, `@Column`); **Hibernate** é a implementação; **Spring Data JPA** gera os repositórios.
- `ActivityEventRepository extends JpaRepository<ActivityEvent, UUID>` dá-te `save`, `findById`, `findAll`, `count`… sem escrever nada.
- `findTop20ByOrderByReceivedAtDesc()` é gerado a partir do **nome** do método.
- `@Query` com **JPQL** escreve-se sobre entidades (`ActivityEvent e`), não sobre tabelas.
- `@Query(nativeQuery = true)` é SQL puro, para o que o JPA não tem (aqui, o `ON CONFLICT`).

**Armadilhas clássicas do ORM** (perguntas de entrevista):
- **N+1 queries:** carregar 100 tarefas e depois aceder a `tarefa.getUser()` em cada uma faz 101 queries. Solução: `JOIN FETCH` ou `@EntityGraph`.
- **`ddl-auto=update` em produção:** o Hibernate altera o schema sozinho, sem revisão nem rollback. Aqui está `validate`: o Flyway cria, o Hibernate só confirma que bate certo. Se a entidade e a tabela divergirem, o serviço **não arranca**, o que é bom.
- **`open-in-view`:** por omissão, o Spring mantém a ligação à BD aberta durante toda a resposta HTTP. Desligámo-lo (`open-in-view: false`).
- **Expor entidades na API:** o controller devolve **DTOs** (`Summary`, `ActivityView`), não a entidade, para o JSON não ficar acoplado ao schema.

Saber SQL à mão (como no projeto Node) é o que te permite perceber o que o Hibernate gera. Liga `spring.jpa.show-sql: true` e compara.

## 6. Flyway

`src/main/resources/db/migration/V1__create_activity_events.sql`. Regras iguais às do nosso `migrate.js`: nunca editar uma migração aplicada, criar V2, V3… O Flyway acrescenta checksums (deteta se alguém editou uma antiga), locks entre instâncias (o que faltava ao `migrate.js`, exercício C13), e a tabela `flyway_schema_history`.

Repara: o serviço usa o **schema** `activity`, separado das tabelas da API Node. Em microserviços, cada serviço é dono dos seus dados, e nenhum outro lhe escreve diretamente nas tabelas. Aqui partilham o servidor Postgres por simplicidade; numa empresa teriam bases (e credenciais) diferentes.

## 7. Spring Security com Keycloak

Três peças:

1. `application.yml`: `issuer-uri`, `jwk-set-uri` e `audiences`. O Spring valida assinatura, `iss`, `aud` e `exp` sozinho. É exatamente o que o `oidcVerifier.js` faz, mas declarativo.
2. `SecurityConfig.securityFilterChain`: o que é público (health e métricas) e o resto exige autenticação.
3. `KeycloakRealmRoles`: o Keycloak põe os papéis em `realm_access.roles`, e o Spring, por omissão, só lê `scope`. Sem este conversor, o `hasRole('admin')` falharia **sempre** com 403. É um dos erros mais comuns em integrações reais, por isso tem um teste próprio.

`@PreAuthorize("hasRole('admin')")` no controller: 401 sem token, 403 com token mas sem papel, 200 com o papel.

## 8. Testes em Java

| Teste | Tipo | O que sobe |
|---|---|---|
| `ActivityServiceTest` | unidade, Mockito | nada do Spring |
| `TaskEventParserTest` | unidade | nada |
| `KeycloakRealmRolesTest` | unidade | nada |
| `ActivityControllerTest` | **slice** `@WebMvcTest` | só a camada web e a segurança, sem BD nem Kafka |

Correr (com Maven instalado, ou em Docker como abaixo):

```bash
cd src/activity
mvn test
# sem Maven local:
docker run --rm -v "$PWD:/app" -v workshop-m2:/root/.m2 -w /app maven:3.9-eclipse-temurin-21 mvn -B test
```

Um teste apanhou um problema real enquanto escrevíamos o serviço: a API Node envia campos que o Java não conhecia (`created_at`), e um `ObjectMapper` estrito rejeitava a mensagem inteira. A correção foi `@JsonIgnoreProperties(ignoreUnknown = true)` no contrato: o padrão **tolerant reader**, que permite ao produtor acrescentar campos sem obrigar todos os consumidores a um deploy ao mesmo tempo.

**O que falta, e é padrão na indústria:** **Testcontainers**, testes de integração que arrancam um Postgres e um Kafka reais em Docker dentro do próprio teste (`@SpringBootTest` + `@Testcontainers`). É o exercício D9.

## 9. Build e imagem

`Dockerfile` multi-stage: Maven + JDK compilam; a imagem final só tem JRE + JAR (450 MB, contra 281 MB da API Node e 74 MB do frontend em Nginx; vê `docker images | grep workshop`). `-XX:MaxRAMPercentage=75` faz a JVM respeitar o limite de memória do contentor. A JVM demora ~40 s a arrancar aqui, contra < 1 s do Node; por isso o healthcheck tem `start_period: 30s`. Para arranques rápidos existem o **GraalVM native image** e o **CDS**, que vais ver em empresas que correm Spring em serverless.

## 10. Exercícios

- **D9. Testcontainers:** um `@SpringBootTest` que arranca Postgres e Kafka em contentores, publica um evento e verifica a linha em `activity_events`.
- **D10. Nova rota:** `GET /api/activity/users/{userId}`, só para admins, com uma query derivada do nome (`findByUserIdOrderByReceivedAtDesc`). Escreve primeiro o teste `@WebMvcTest`.
- **D11. Validação:** um `POST` com `@Valid` e um record com `@NotBlank`/`@Size`, e um `@RestControllerAdvice` que devolve erros no formato `{ "error": "..." }`, igual à API Node.
- **D12. Refazer a API Node em Spring:** mesmas rotas, mesma BD, mesmos testes de contrato (o `openapi.yaml` diz-te o que tem de bater certo). É o exercício que mais te prepara para uma vaga Java.

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 18`.

**1.** O que permite a injeção de dependências por CONSTRUTOR, usada em ActivityService?

- a) Torna o código mais lento a correr
- b) Instanciar a classe em testes com 'new ActivityService(mock, ...)', sem precisar do Spring a correr
- c) É uma exigência obrigatória da linguagem Java
- d) Substitui a necessidade do Maven

<details><summary>Resposta</summary>

**b) Instanciar a classe em testes com 'new ActivityService(mock, ...)', sem precisar do Spring a correr** — É por isso que ActivityServiceTest não precisa de @SpringBootTest nem de Mockito 'pesado'.

</details>

**2.** Porque está o Hibernate configurado com ddl-auto: validate, e não update?

- a) 'update' não existe no Spring Boot
- b) Com 'validate', o Hibernate só confirma que o schema bate certo; quem o cria/altera é o Flyway, com histórico e controlo
- c) É mais rápido no arranque da aplicação
- d) É o valor por omissão do Spring Boot em qualquer caso

<details><summary>Resposta</summary>

**b) Com 'validate', o Hibernate só confirma que o schema bate certo; quem o cria/altera é o Flyway, com histórico e controlo** — Deixar o Hibernate alterar o schema sozinho em produção é uma das armadilhas clássicas do ORM.

</details>

**3.** Que anotação do Spring Security garante que, sem o papel 'admin' no token, a rota devolve 403?

<details><summary>Resposta</summary>

**@preauthorize** — @PreAuthorize("hasRole('admin')") no ActivityController.

</details>

**4.** Qual foi o erro real encontrado ao integrar o Keycloak com o Spring Security neste projeto?

- a) O Postgres não conseguia ligar-se
- b) O Spring só lia por omissão o claim 'scope'; sem um conversor para 'realm_access.roles', hasRole('admin') falhava sempre com 403
- c) O Maven não conseguia compilar o projeto
- d) O Flyway apagava os dados existentes a cada arranque

<details><summary>Resposta</summary>

**b) O Spring só lia por omissão o claim 'scope'; sem um conversor para 'realm_access.roles', hasRole('admin') falhava sempre com 403** — Foi corrigido com o conversor KeycloakRealmRoles, que tem o seu próprio teste dedicado.

</details>

**5.** Porque é que o contrato TaskEvent tem @JsonIgnoreProperties(ignoreUnknown = true)?

- a) É só uma questão de estilo de código
- b) Padrão 'tolerant reader': permite ao produtor (API Node) acrescentar campos novos sem obrigar este consumidor a um deploy coordenado
- c) Acelera o processo de parsing do JSON
- d) É obrigatório em todos os records do Java

<details><summary>Resposta</summary>

**b) Padrão 'tolerant reader': permite ao produtor (API Node) acrescentar campos novos sem obrigar este consumidor a um deploy coordenado** — Sem isto, o campo 'created_at' extra da API Node fazia o parsing falhar por completo.

</details>

<!-- quiz:end -->
