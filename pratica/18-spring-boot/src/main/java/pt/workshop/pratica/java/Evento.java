package pt.workshop.pratica.java;

// Já feito: uma interface SELADA (sealed). Só estes três records a podem implementar, e o
// compilador sabe-o. É o equivalente Java da discriminated union do TypeScript (módulo 07).
public sealed interface Evento permits Evento.TarefaCriada, Evento.TarefaConcluida, Evento.TarefaApagada {

    record TarefaCriada(long id, String titulo) implements Evento {}

    record TarefaConcluida(long id, String titulo) implements Evento {}

    record TarefaApagada(long id) implements Evento {}
}
