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

## Prática: escreve tu

Um projeto Maven pequeno, com o mesmo Spring Boot do `src/activity`, onde escreves Java do zero: primeiro a linguagem (sem Spring), depois uma API REST, depois a validação e os erros. Os exercícios do P2 e do P3 são a mesma API de notas do [módulo 04](04-api-em-camadas.md#prática-escreve-tu), agora em Spring: compara as duas versões quando acabares, e vês o [dicionário Node → Spring](#2-dicionário-node--spring) da secção 2 em código teu.

**Verificar:** `npm run verificar 18` (dentro de `pratica/`). Só um exercício: `npm run verificar 18 JavaModerno`, `... 18 NotasController` ou `... 18 Validacao`. Sem o Maven instalado, o verificador corre-o num contentor Docker (`maven:3.9-eclipse-temurin-21`).

Uma diferença em relação aos exercícios de JavaScript: o Maven **compila tudo** antes de correr qualquer teste. Se o P2 estiver a meio e não compilar, nem o P1 corre. Deixa sempre o código num estado que compila.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Java moderno: records, streams, `Optional`, `switch` com padrões (≈40 min)

**Ficheiros:** `pratica/18-spring-boot/src/main/java/pt/workshop/pratica/java/` (`Tarefa.java`, `Estatisticas.java`, `Eventos.java`)

O Java de 2026 não é o dos livros antigos, com *getters* e *setters* escritos à mão. Escreve:

- o **construtor compacto** do record `Tarefa` (valida e limpa o título);
- quatro consultas em `Estatisticas`, cada uma com **uma só** expressão de streams (sem `for`, sem `if`);
- `Eventos.descrever`, com um `switch` que **desconstrói** cada record da interface `sealed` `Evento`, sem `default`.

**Sintaxe que vais praticar:** `record` e construtor compacto, `.stream().filter().map().sorted().toList()`, referências a métodos (`Tarefa::titulo`), `Comparator.comparing`, `Optional` e `.findFirst()`, `Collectors.partitioningBy`, `switch` como expressão com padrões de record (`case Evento.TarefaCriada(var id, var titulo) ->`), `"...".formatted(...)`.

<details>
<summary>Pista</summary>

- Num construtor compacto **não** se escreve `this.titulo = ...`: reatribuis o **parâmetro** (`titulo = titulo.strip();`) e o Java atribui o campo no fim.
- As streams leem-se como uma frase: "das tarefas, filtra as por fazer com prazo antes de hoje, ordena pelo prazo, fica com o título, faz uma lista". É uma linha de código por cada pedaço da frase.
- Se o `switch` se queixar de que não é exaustivo, falta um `case`. Com uma interface `sealed`, o compilador sabe exatamente quantos são.
</details>

<details>
<summary>Solução de referência</summary>

```java
// Tarefa.java
package pt.workshop.pratica.java;

import java.time.LocalDate;

public record Tarefa(long id, String titulo, boolean feita, LocalDate prazo) {

    // Construtor COMPACTO: sem lista de parâmetros. Corre antes de os campos serem atribuídos,
    // e pode validar ou trocar os valores (aqui, `titulo` é o parâmetro, e reatribuí-lo muda o campo).
    public Tarefa {
        if (titulo == null || titulo.isBlank()) {
            throw new IllegalArgumentException("O título é obrigatório");
        }
        titulo = titulo.strip();
    }
}
```

```java
// Estatisticas.java
package pt.workshop.pratica.java;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public final class Estatisticas {

    private Estatisticas() {}

    public static long contarFeitas(List<Tarefa> tarefas) {
        return tarefas.stream().filter(Tarefa::feita).count(); // Tarefa::feita = t -> t.feita()
    }

    public static List<String> titulosAtrasados(List<Tarefa> tarefas, LocalDate hoje) {
        return tarefas.stream()
                .filter(t -> !t.feita() && t.prazo() != null && t.prazo().isBefore(hoje))
                .sorted(Comparator.comparing(Tarefa::prazo))
                .map(Tarefa::titulo)
                .toList();
    }

    public static Optional<Tarefa> procurar(List<Tarefa> tarefas, long id) {
        return tarefas.stream().filter(t -> t.id() == id).findFirst();
    }

    public static Map<Boolean, List<String>> titulosPorEstado(List<Tarefa> tarefas) {
        // partitioningBy divide em dois grupos (true/false); o segundo argumento diz o que guardar em cada um.
        return tarefas.stream()
                .collect(Collectors.partitioningBy(Tarefa::feita, Collectors.mapping(Tarefa::titulo, Collectors.toList())));
    }
}
```

```java
// Eventos.java
package pt.workshop.pratica.java;

public final class Eventos {

    private Eventos() {}

    public static String descrever(Evento evento) {
        // switch como EXPRESSÃO (devolve um valor), com padrões que desconstroem cada record.
        // Sem default: se alguém acrescentar um 4.º record ao `permits`, isto deixa de compilar.
        return switch (evento) {
            case Evento.TarefaCriada(var id, var titulo) -> "Tarefa %d criada: \"%s\"".formatted(id, titulo);
            case Evento.TarefaConcluida(var id, var titulo) -> "Tarefa %d concluída: \"%s\"".formatted(id, titulo);
            case Evento.TarefaApagada(var id) -> "Tarefa %d apagada".formatted(id);
        };
    }
}
```

Compara o `Evento` sealed com a *discriminated union* `TaskEvent` do [módulo 07](07-worker.md#prática-escreve-tu): a mesma ideia, em duas linguagens. E o `switch` sem `default` faz o mesmo papel que o `const exhaustive: never` do TypeScript.
</details>

### P2 · Uma API REST com Spring MVC (≈45 min)

**Ficheiros:** escreves tu, do zero, no pacote `pt.workshop.pratica.notas` (o `package-info.java` lista o que é preciso)

- `GET /api/notas` → a lista, pela ordem de criação;
- `POST /api/notas` com `{"titulo": "..."}` → `201`, a nota criada (`{"id", "titulo", "afixada"}`) e o cabeçalho `Location: /api/notas/<id>`;
- `GET /api/notas/{id}` → a nota, ou `404`;
- `PUT /api/notas/{id}/afixada` → a nota afixada, ou `404`;
- `DELETE /api/notas/{id}` → `204` sem corpo, ou `404`.

Guarda as notas em memória, num `@Service` que o `@RestController` recebe pelo **construtor** (secção 3). Os testes usam o `MockMvc`: fazem pedidos HTTP à aplicação sem abrir uma porta de rede.

**Sintaxe que vais praticar:** `@RestController`, `@RequestMapping`, `@GetMapping("/{id}")`, `@PathVariable`, `@RequestBody`, `ResponseEntity.created(...).body(...)`, `ResponseEntity.noContent().build()`, `@Service`, injeção pelo construtor, `ConcurrentHashMap` e `AtomicLong`.

<details>
<summary>Pista</summary>

Para o `404`, o serviço lança uma exceção tua (por exemplo `NotaNaoEncontradaException extends RuntimeException`) e a classe da exceção leva `@ResponseStatus(HttpStatus.NOT_FOUND)`. Chega para o P2. No P3 vais trocar isso por um tratamento central, com o corpo JSON certo.

Porque é que o mapa tem de ser um `ConcurrentHashMap`? O Node atende um pedido de cada vez numa só thread; o Tomcat do Spring atende vários ao mesmo tempo, em threads diferentes. Um `HashMap` normal, escrito por duas threads ao mesmo tempo, pode corromper-se.
</details>

<details>
<summary>Solução de referência</summary>

```java
// Nota.java
package pt.workshop.pratica.notas;

// O que a API devolve. O Jackson (o JSON do Spring) converte records sozinho: {"id":1,"titulo":"...","afixada":false}.
public record Nota(long id, String titulo, boolean afixada) {}
```

```java
// NotaNaoEncontradaException.java
package pt.workshop.pratica.notas;

// Exceção do domínio: o serviço lança-a sem saber o que é um 404. Quem a traduz é o ErrosHandler.
public class NotaNaoEncontradaException extends RuntimeException {
    public NotaNaoEncontradaException(long id) {
        super("Nota %d não encontrada".formatted(id));
    }
}
```

```java
// NotasService.java
package pt.workshop.pratica.notas;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

// @Service: o Spring cria UMA instância e injeta-a em quem a pedir (o controller).
// Em memória, como o memoryNoteRepository do módulo 04. Num serviço real, isto seria um repositório JPA.
@Service
public class NotasService {

    // Um servidor web atende vários pedidos ao mesmo tempo, em threads diferentes (ao contrário do Node).
    // Por isso: um mapa e um contador que aguentam acessos concorrentes.
    private final Map<Long, Nota> notas = new ConcurrentHashMap<>();
    private final AtomicLong proximoId = new AtomicLong(1);

    public List<Nota> listar() {
        List<Nota> lista = new ArrayList<>(notas.values());
        lista.sort((a, b) -> Long.compare(a.id(), b.id()));
        return lista;
    }

    public Nota obter(long id) {
        Nota nota = notas.get(id);
        if (nota == null) throw new NotaNaoEncontradaException(id);
        return nota;
    }

    public Nota criar(String titulo) {
        Nota nota = new Nota(proximoId.getAndIncrement(), titulo.strip(), false);
        notas.put(nota.id(), nota);
        return nota;
    }

    public Nota afixar(long id) {
        Nota afixada = new Nota(id, obter(id).titulo(), true); // records são imutáveis: cria-se um novo
        notas.put(id, afixada);
        return afixada;
    }

    public void apagar(long id) {
        if (notas.remove(id) == null) throw new NotaNaoEncontradaException(id);
    }
}
```

```java
// NotasController.java
package pt.workshop.pratica.notas;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Equivalente ao router Express do módulo 04: traduz HTTP em chamadas ao serviço, e mais nada.
@RestController
@RequestMapping("/api/notas")
public class NotasController {

    private final NotasService service;

    // Injeção pelo construtor: o Spring vê que é preciso um NotasService e passa o que criou.
    // (Sem @Autowired: com um só construtor, o Spring usa-o sozinho.)
    public NotasController(NotasService service) {
        this.service = service;
    }

    @GetMapping
    public List<Nota> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Nota obter(@PathVariable long id) {
        return service.obter(id);
    }

    @PostMapping
    public ResponseEntity<Nota> criar(@Valid @RequestBody NovaNota pedido) {
        Nota nota = service.criar(pedido.titulo());
        return ResponseEntity.created(URI.create("/api/notas/" + nota.id())).body(nota);
    }

    @PutMapping("/{id}/afixada")
    public Nota afixar(@PathVariable long id) {
        return service.afixar(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> apagar(@PathVariable long id) {
        service.apagar(id);
        return ResponseEntity.noContent().build();
    }
}
```
</details>

### P3 · Validação e erros no formato da API Node (≈30 min)

**Ficheiros:** o record do corpo do `POST` (ex.: `NovaNota.java`) e um `@RestControllerAdvice` novo

Um frontend que fala com dois serviços não deve ter de saber em que linguagem cada um foi escrito. Os erros desta API têm de ter **exatamente** o formato e as mensagens da API Node: `{"error": "O título é obrigatório"}`, `{"error": "Máximo de 120 caracteres"}`, `{"error": "JSON inválido"}`, `{"error": "Nota 99 não encontrada"}` e `{"error": "ID inválido"}` (para `/api/notas/abc`).

**Sintaxe que vais praticar:** anotações de Bean Validation num record (`@NotBlank(message = ...)`, `@Size(max = ..., message = ...)`), `@Valid`, `@RestControllerAdvice`, `@ExceptionHandler`, `@ResponseStatus`, `Map.of(...)`.

<details>
<summary>Pista</summary>

Cada caso de erro corresponde a uma exceção diferente, lançada pelo Spring antes de o teu código correr: `MethodArgumentNotValidException` (o `@Valid` falhou), `HttpMessageNotReadableException` (o corpo não é JSON) e `MethodArgumentTypeMismatchException` (`"abc"` não se converte em `long`). Um método `@ExceptionHandler` para cada uma, todos na mesma classe `@RestControllerAdvice`.
</details>

<details>
<summary>Solução de referência</summary>

```java
// NovaNota.java
package pt.workshop.pratica.notas;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// O corpo do POST. As anotações são regras de Bean Validation, verificadas pelo @Valid no controller.
// As mensagens são as MESMAS da API Node (src/api/src/validation/taskSchemas.js).
public record NovaNota(
        @NotBlank(message = "O título é obrigatório") @Size(max = 120, message = "Máximo de 120 caracteres") String titulo) {}
```

```java
// ErrosHandler.java
package pt.workshop.pratica.notas;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

// O equivalente ao middleware de erro do Express (src/api/src/middleware/errorHandler.js):
// um só sítio que transforma exceções em respostas {"error": "..."}.
@RestControllerAdvice
public class ErrosHandler {

    @ExceptionHandler(NotaNaoEncontradaException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    Map<String, String> naoEncontrada(NotaNaoEncontradaException e) {
        return Map.of("error", e.getMessage());
    }

    // @Valid falhou: devolvemos a mensagem do primeiro problema, como a API Node.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, String> invalido(MethodArgumentNotValidException e) {
        return Map.of("error", e.getBindingResult().getFieldErrors().getFirst().getDefaultMessage());
    }

    // O corpo nem sequer é JSON. A mensagem original do Jackson revela detalhes internos: não a mostramos.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, String> jsonInvalido() {
        return Map.of("error", "JSON inválido");
    }

    // /api/notas/abc: "abc" não se converte em long.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, String> idInvalido() {
        return Map.of("error", "ID inválido");
    }
}
```

Com o `ErrosHandler` a tratar a `NotaNaoEncontradaException`, o `@ResponseStatus` na própria exceção (da pista do P2) deixa de ser preciso: a solução de referência já não o tem.
</details>

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
