import pygame
import pytest

import principal
from cobra import Jogo
from grelha import BAIXO, CIMA, ESQUERDA, Posicao
from principal import CELULA, CORES, desenhar, traduzir_evento


@pytest.fixture(scope="module", autouse=True)
def pygame_iniciado():
    pygame.init()
    yield
    pygame.quit()


def tecla(k):
    return pygame.event.Event(pygame.KEYDOWN, key=k, mod=0, unicode="", scancode=0)


def test_traduzir_teclas():
    assert traduzir_evento(tecla(pygame.K_UP)) == CIMA
    assert traduzir_evento(tecla(pygame.K_s)) == BAIXO
    assert traduzir_evento(tecla(pygame.K_a)) == ESQUERDA
    assert traduzir_evento(tecla(pygame.K_p)) == "pausa"
    assert traduzir_evento(tecla(pygame.K_SPACE)) == "pausa"
    assert traduzir_evento(tecla(pygame.K_RETURN)) == "recomecar"
    assert traduzir_evento(tecla(pygame.K_ESCAPE)) == "sair"
    assert traduzir_evento(pygame.event.Event(pygame.QUIT)) == "sair"
    assert traduzir_evento(tecla(pygame.K_x)) is None
    assert traduzir_evento(pygame.event.Event(pygame.MOUSEMOTION, pos=(0, 0), rel=(0, 0), buttons=(0, 0, 0))) is None


def jogo_conhecido():
    j = Jogo(largura=12, altura=10, semente=1)
    j.cobra.corpo = [Posicao(8, 6), Posicao(7, 6), Posicao(6, 6)]
    j.comida = Posicao(3, 8)
    j.pontos = 7
    return j


def centro(x, y):
    return (x * CELULA + CELULA // 2, y * CELULA + CELULA // 2)


def cor(ecra, ponto):
    return tuple(ecra.get_at(ponto))[:3]


def pixeis_de(ecra, cor_procurada, retangulo):
    x0, y0, w, h = retangulo
    return sum(1 for x in range(x0, x0 + w) for y in range(y0, y0 + h) if cor(ecra, (x, y)) == cor_procurada)


def novo_ecra(j):
    return pygame.Surface((j.largura * CELULA, j.altura * CELULA))


def test_desenha_fundo_cobra_cabeca_e_comida_nas_celulas_certas():
    j = jogo_conhecido()
    ecra = novo_ecra(j)
    desenhar(ecra, j, pygame.font.Font(None, 24))
    assert cor(ecra, centro(8, 6)) == CORES["cabeca"]
    assert cor(ecra, centro(7, 6)) == CORES["cobra"]
    assert cor(ecra, centro(6, 6)) == CORES["cobra"]
    assert cor(ecra, centro(3, 8)) == CORES["comida"]
    assert cor(ecra, centro(10, 2)) == CORES["fundo"]
    assert cor(ecra, (j.largura * CELULA - 1, j.altura * CELULA - 1)) == CORES["fundo"], "o fundo tem de cobrir o ecrã todo"


def test_cada_celula_e_um_quadrado_do_tamanho_certo():
    j = jogo_conhecido()
    ecra = novo_ecra(j)
    desenhar(ecra, j, pygame.font.Font(None, 24))
    assert pixeis_de(ecra, CORES["comida"], (2 * CELULA, 7 * CELULA, 3 * CELULA, 3 * CELULA)) == CELULA * CELULA


def test_escreve_os_pontos_no_canto():
    j = jogo_conhecido()
    ecra = novo_ecra(j)
    desenhar(ecra, j, pygame.font.Font(None, 24))
    assert pixeis_de(ecra, CORES["texto"], (0, 0, 5 * CELULA, 2 * CELULA)) > 20, "não encontrei o texto dos pontos"


def test_ao_perder_mostra_a_mensagem_no_centro():
    j = jogo_conhecido()
    fonte = pygame.font.Font(None, 24)
    regiao = (0, 4 * CELULA, j.largura * CELULA, 2 * CELULA)
    ecra = novo_ecra(j)
    desenhar(ecra, j, fonte)
    assert pixeis_de(ecra, CORES["texto"], regiao) == 0, "a jogar, não há mensagem no centro"
    j.estado = "perdeu"
    desenhar(ecra, j, fonte)
    assert pixeis_de(ecra, CORES["texto"], regiao) > 20, "ao perder, a mensagem devia aparecer no centro"


def test_o_ciclo_principal_corre_e_a_cobra_anda():
    jogo = principal.correr(max_frames=40)   # ≈ 0,7 s a 60 FPS → ≈ 5 passos a 8 por segundo
    assert isinstance(jogo, Jogo)
    assert jogo.cobra.cabeca.x > jogo.largura // 2, "a cobra devia ter andado para a direita"
