package pt.workshop.pratica.notas;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

// P3 · Validação e erros no MESMO formato da API Node: sempre {"error": "mensagem"}.
// Um frontend que fala com os dois serviços não deve ter de saber em que linguagem foi escrito cada um.
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ValidacaoTest {

    @Autowired
    MockMvc mvc;

    ResultActions postar(String corpo) throws Exception {
        return mvc.perform(post("/api/notas").contentType(MediaType.APPLICATION_JSON).content(corpo));
    }

    @Test
    void tituloEmFaltaOuEmBrancoDa400ComAMensagemDaApiNode() throws Exception {
        for (String corpo : new String[] {"{}", "{\"titulo\":\"\"}", "{\"titulo\":\"   \"}"}) {
            postar(corpo).andExpect(status().isBadRequest()).andExpect(content().json("{\"error\":\"O título é obrigatório\"}", true));
        }
    }

    @Test
    void tituloComprido() throws Exception {
        postar("{\"titulo\":\"" + "x".repeat(121) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().json("{\"error\":\"Máximo de 120 caracteres\"}", true));
    }

    @Test
    void jsonInvalidoDa400ComUmaMensagemLimpa() throws Exception {
        postar("{isto não é json").andExpect(status().isBadRequest()).andExpect(content().json("{\"error\":\"JSON inválido\"}", true));
    }

    @Test
    void notaQueNaoExisteDa404ComAMensagem() throws Exception {
        mvc.perform(get("/api/notas/99"))
                .andExpect(status().isNotFound())
                .andExpect(content().json("{\"error\":\"Nota 99 não encontrada\"}", true));
    }

    @Test
    void idQueNaoEUmNumeroDa400() throws Exception {
        mvc.perform(get("/api/notas/abc")).andExpect(status().isBadRequest()).andExpect(content().json("{\"error\":\"ID inválido\"}", true));
    }
}
