# P1 · A grelha do jogo: posições e direções. Lógica pura, sem pygame.
# Ver docs/61-jogo-pygame.md, secção "Prática".
from dataclasses import dataclass  # noqa: F401

# As direções são tuplos (dx, dy). Atenção: no ecrã, o y CRESCE PARA BAIXO.
CIMA = (0, -1)
BAIXO = (0, 1)
ESQUERDA = (-1, 0)
DIREITA = (1, 0)

# Posicao: uma dataclass IMUTÁVEL (frozen=True) com x e y inteiros.
#   - por ser imutável, pode ir para um set e ser chave de um dict (tem hash)
#   - método mais(direcao) → uma NOVA Posicao, deslocada pela direção
#     Posicao(2, 3).mais(CIMA) == Posicao(2, 2)


def opostas(a, b) -> bool:
    """True se as duas direções forem opostas (ex.: CIMA e BAIXO)."""
    raise NotImplementedError("P1")


def dentro(pos, largura: int, altura: int) -> bool:
    """True se a posição estiver dentro de uma grelha largura × altura (x de 0 a largura-1, ...)."""
    raise NotImplementedError("P1")


def livres(largura: int, altura: int, ocupadas) -> list:
    """Todas as posições da grelha que NÃO estão em `ocupadas`, por linhas: primeiro y=0 da
    esquerda para a direita, depois y=1, ... (uma list comprehension com dois for)."""
    raise NotImplementedError("P1")
