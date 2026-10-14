package pt.workshop.pratica;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Já feito: o ponto de entrada. Os testes do P2 e do P3 precisam dele para saber onde começa a aplicação.
@SpringBootApplication
public class PraticaApplication {
    public static void main(String[] args) {
        SpringApplication.run(PraticaApplication.class, args);
    }
}
