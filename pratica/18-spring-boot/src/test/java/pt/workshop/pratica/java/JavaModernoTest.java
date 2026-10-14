package pt.workshop.pratica.java;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

// P1 · Testes de Java "puro": não arrancam o Spring, por isso correm em milissegundos.
class JavaModernoTest {

    static final LocalDate HOJE = LocalDate.of(2026, 10, 14);

    static final List<Tarefa> TAREFAS = List.of(
            new Tarefa(1, "Ler artigo", false, HOJE.plusDays(2)),
            new Tarefa(2, "Escrever capítulo", false, HOJE.minusDays(3)),
            new Tarefa(3, "Reunião", true, HOJE.minusDays(1)),
            new Tarefa(4, "Pagar a luz", false, HOJE.minusDays(1)),
            new Tarefa(5, "Rever bibliografia", false, null));

    @Test
    void recordGuardaOTituloSemEspacosNasPontas() {
        assertThat(new Tarefa(1, "  Estudar Java  ", false, null).titulo()).isEqualTo("Estudar Java");
        // equals gerado pelo record: compara os VALORES (já limpos pelo teu construtor), não a identidade.
        assertThat(new Tarefa(1, " A ", false, null)).isEqualTo(new Tarefa(1, "A", false, null));
    }

    @Test
    void recordRecusaTitulosNulosOuEmBranco() {
        assertThatThrownBy(() -> new Tarefa(1, null, false, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Tarefa(1, "   ", false, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void contarFeitas() {
        assertThat(Estatisticas.contarFeitas(TAREFAS)).isEqualTo(1);
    }

    @Test
    void titulosAtrasadosSoPorFazerEOrdenadosPorPrazo() {
        assertThat(Estatisticas.titulosAtrasados(TAREFAS, HOJE)).containsExactly("Escrever capítulo", "Pagar a luz");
    }

    @Test
    void procurarDevolveUmOptional() {
        assertThat(Estatisticas.procurar(TAREFAS, 3)).map(Tarefa::titulo).contains("Reunião");
        assertThat(Estatisticas.procurar(TAREFAS, 99)).isEmpty();
    }

    @Test
    void titulosPorEstadoSeparaFeitasDePorFazer() {
        Map<Boolean, List<String>> resultado = Estatisticas.titulosPorEstado(TAREFAS);
        assertThat(resultado.get(true)).containsExactly("Reunião");
        assertThat(resultado.get(false)).containsExactly("Ler artigo", "Escrever capítulo", "Pagar a luz", "Rever bibliografia");
    }

    @Test
    void descreverCadaTipoDeEvento() {
        assertThat(Eventos.descrever(new Evento.TarefaCriada(3, "Estudar Java"))).isEqualTo("Tarefa 3 criada: \"Estudar Java\"");
        assertThat(Eventos.descrever(new Evento.TarefaConcluida(3, "Estudar Java"))).isEqualTo("Tarefa 3 concluída: \"Estudar Java\"");
        assertThat(Eventos.descrever(new Evento.TarefaApagada(3))).isEqualTo("Tarefa 3 apagada");
    }
}
