package pt.workshop.pratica.java;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// P1 · Consultas sobre listas com a API de Streams (ver docs/18-spring-boot.md, secção "Prática").
// Substitui cada `throw` por uma única expressão com streams (sem for, sem if).
public final class Estatisticas {

    private Estatisticas() {
        // só métodos estáticos: não faz sentido criar instâncias
    }

    // Quantas estão feitas.
    public static long contarFeitas(List<Tarefa> tarefas) {
        throw new UnsupportedOperationException("Por fazer: P1");
    }

    // Títulos das tarefas POR FAZER com prazo ANTES de hoje, do prazo mais antigo para o mais recente.
    public static List<String> titulosAtrasados(List<Tarefa> tarefas, LocalDate hoje) {
        throw new UnsupportedOperationException("Por fazer: P1");
    }

    // A tarefa com este id, ou Optional.empty().
    public static Optional<Tarefa> procurar(List<Tarefa> tarefas, long id) {
        throw new UnsupportedOperationException("Por fazer: P1");
    }

    // { true: [títulos das feitas], false: [títulos das por fazer] }, pela ordem da lista.
    public static Map<Boolean, List<String>> titulosPorEstado(List<Tarefa> tarefas) {
        throw new UnsupportedOperationException("Por fazer: P1");
    }
}
