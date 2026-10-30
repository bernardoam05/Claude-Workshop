# P4 · O jogo a sério, com o pygame: desenhar, ler o teclado, e o ciclo principal.
# Para jogar (dentro de pratica/61-jogo-pygame/):  ../.venv/bin/python principal.py
import pygame

from cobra import Jogo  # noqa: F401
from grelha import BAIXO, CIMA, DIREITA, ESQUERDA  # noqa: F401
from relogio import PassoFixo  # noqa: F401

CELULA = 24                  # lado de cada quadrado da grelha, em píxeis
PASSOS_POR_SEGUNDO = 8       # a velocidade da cobra
FPS = 60                     # quantas vezes por segundo se desenha o ecrã

CORES = {
    "fundo": (18, 18, 28),
    "cobra": (80, 200, 120),
    "cabeca": (40, 150, 90),
    "comida": (220, 60, 60),
    "texto": (240, 240, 240),
}

TECLAS = {
    pygame.K_UP: CIMA, pygame.K_w: CIMA,
    pygame.K_DOWN: BAIXO, pygame.K_s: BAIXO,
    pygame.K_LEFT: ESQUERDA, pygame.K_a: ESQUERDA,
    pygame.K_RIGHT: DIREITA, pygame.K_d: DIREITA,
}


def traduzir_evento(evento):
    """Converte um evento do pygame numa ação do jogo:
      - pygame.QUIT, ou a tecla Escape → "sair"
      - uma tecla de TECLAS → a direção correspondente
      - P ou espaço → "pausa"
      - Enter (K_RETURN) → "recomecar"
      - qualquer outro evento → None"""
    raise NotImplementedError("P4")


def desenhar(ecra, jogo, fonte):
    """Desenha um frame completo:
      1. pinta o ecrã todo com a cor "fundo"
      2. a comida: um quadrado "comida" na sua célula (pygame.draw.rect)
      3. o corpo da cobra: um quadrado "cobra" por célula, e a CABEÇA com a cor "cabeca"
         (a célula (x, y) ocupa o retângulo (x*CELULA, y*CELULA, CELULA, CELULA))
      4. os pontos ("Pontos: 3"), a cor "texto", no canto superior esquerdo, em (8, 8)
      5. se o estado for "perdeu": a frase "Fim! Enter para recomeçar" a cor "texto",
         centrada no ecrã; se for "pausa": "Pausa", centrada
    Não chama o pygame.display.flip(): isso é trabalho do ciclo principal."""
    raise NotImplementedError("P4")


def correr(max_frames=None):
    """O ciclo principal: inicia o pygame, abre a janela (largura e altura do jogo × CELULA),
    e, em cada frame:
      1. trata todos os eventos (traduzir_evento): direção → jogo.cobra.virar, "pausa" →
         jogo.alternar_pausa(), "recomecar" (só quando perdeu ou ganhou) → um Jogo novo, "sair" → termina
      2. corre os passos de lógica que o PassoFixo mandar (com o dt do relógio do pygame)
      3. desenha e faz flip
    Termina ao fim de max_frames (se não for None), sai do pygame e devolve o jogo."""
    raise NotImplementedError("P4")


if __name__ == "__main__":
    correr()
