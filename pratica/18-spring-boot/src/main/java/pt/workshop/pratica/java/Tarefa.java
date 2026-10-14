package pt.workshop.pratica.java;

import java.time.LocalDate;

// P1 · Um record: uma classe imutável cujo construtor, getters (titulo(), feita()...), equals,
// hashCode e toString o Java escreve por ti. O prazo pode ser null (tarefa sem prazo).
//
// Escreve aqui um CONSTRUTOR COMPACTO que recusa títulos nulos ou em branco com uma
// IllegalArgumentException, e guarda o título sem espaços nas pontas (strip()).
public record Tarefa(long id, String titulo, boolean feita, LocalDate prazo) {
}
