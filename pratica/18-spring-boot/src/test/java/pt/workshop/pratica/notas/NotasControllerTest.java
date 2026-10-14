package pt.workshop.pratica.notas;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

// P2 · A API de notas, testada por HTTP com o MockMvc (sem abrir uma porta de rede a sério).
// @DirtiesContext: cada teste começa com uma aplicação nova, ou seja, sem notas e com ids desde 1.
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class NotasControllerTest {

    @Autowired
    MockMvc mvc;

    ResultActions criar(String titulo) throws Exception {
        return mvc.perform(post("/api/notas").contentType(MediaType.APPLICATION_JSON).content("{\"titulo\":\"" + titulo + "\"}"));
    }

    @Test
    void comecaSemNotas() throws Exception {
        mvc.perform(get("/api/notas")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void criarDevolve201ComALocalizacaoDaNovaNota() throws Exception {
        criar("Estudar Spring")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/notas/1"))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.titulo").value("Estudar Spring"))
                .andExpect(jsonPath("$.afixada").value(false));
    }

    @Test
    void listarPelaOrdemDeCriacao() throws Exception {
        criar("Primeira");
        criar("Segunda");
        mvc.perform(get("/api/notas"))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].titulo").value("Primeira"))
                .andExpect(jsonPath("$[1].id").value(2));
    }

    @Test
    void obterUmaNotaPeloId() throws Exception {
        criar("Estudar Spring");
        mvc.perform(get("/api/notas/1")).andExpect(status().isOk()).andExpect(jsonPath("$.titulo").value("Estudar Spring"));
    }

    @Test
    void notaQueNaoExisteDa404() throws Exception {
        criar("Existe").andExpect(status().isCreated()); // a API existe: o 404 é da nota, não da rota
        mvc.perform(get("/api/notas/99")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/notas/99")).andExpect(status().isNotFound());
        mvc.perform(put("/api/notas/99/afixada")).andExpect(status().isNotFound());
    }

    @Test
    void afixarUmaNota() throws Exception {
        criar("Importante");
        mvc.perform(put("/api/notas/1/afixada")).andExpect(status().isOk()).andExpect(jsonPath("$.afixada").value(true));
        mvc.perform(get("/api/notas/1")).andExpect(jsonPath("$.afixada").value(true));
    }

    @Test
    void apagarDevolve204EDepoisJaNaoExiste() throws Exception {
        criar("Temporária");
        mvc.perform(delete("/api/notas/1")).andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/notas/1")).andExpect(status().isNotFound());
    }
}
