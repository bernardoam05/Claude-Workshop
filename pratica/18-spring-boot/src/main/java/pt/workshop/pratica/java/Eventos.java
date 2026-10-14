package pt.workshop.pratica.java;

// P1 · Pattern matching num switch (Java 21).
public final class Eventos {

    private Eventos() {}

    // 'Tarefa 3 criada: "Estudar Java"' · 'Tarefa 3 concluída: "Estudar Java"' · 'Tarefa 3 apagada'
    // Escreve-o com UM switch sobre o evento, com um case por record, que desconstrói os campos
    // (case Evento.TarefaCriada(var id, var titulo) -> ...) e SEM default: como Evento é sealed,
    // o compilador confirma que todos os casos estão tratados.
    public static String descrever(Evento evento) {
        throw new UnsupportedOperationException("Por fazer: P1");
    }
}
