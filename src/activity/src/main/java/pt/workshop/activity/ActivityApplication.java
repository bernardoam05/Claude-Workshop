package pt.workshop.activity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Ponto de entrada. @SpringBootApplication liga três coisas:
// - @Configuration: esta classe pode declarar beans;
// - @EnableAutoConfiguration: o Spring configura sozinho o que encontra no classpath (Tomcat, JPA, Kafka...);
// - @ComponentScan: procura @Component/@Service/@RestController neste pacote e nos subpacotes.
//
// É a mesma ideia do nosso index.js (ponto de composição), mas a ligação das peças é feita pelo
// contentor de injeção de dependências do Spring, em vez de ser escrita à mão.
@SpringBootApplication
public class ActivityApplication {

    public static void main(String[] args) {
        SpringApplication.run(ActivityApplication.class, args);
    }
}
