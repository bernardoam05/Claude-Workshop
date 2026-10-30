# P2 · As regras do jogo: a cobra e o jogo. Ainda sem pygame: tudo isto se testa sem ecrã.
import random  # noqa: F401

from grelha import DIREITA, Posicao, dentro, livres, opostas  # noqa: F401


class Cobra:
    """O corpo é uma lista de Posicao, com a CABEÇA PRIMEIRO.

    Cobra(cabeca, direcao=DIREITA, tamanho=3): a cabeça na posição dada e o resto do corpo atrás
      dela, no sentido contrário à direção. Cobra(Posicao(5, 5)) → corpo [(5,5), (4,5), (3,5)]
    cabeca: uma property com a primeira posição
    virar(direcao): muda a direção, EXCETO se for a oposta à do ÚLTIMO avanço (a cobra não pode
      voltar para trás sobre si própria). Atenção ao truque: a andar para a direita, carregar em
      CIMA e logo a seguir em ESQUERDA, antes do próximo avanço, não pode virá-la para trás.
    avancar(crescer=False): acrescenta uma cabeça nova na direção atual; se não crescer, tira
      a última posição da cauda
    colide_consigo(): True se a cabeça estiver em cima de outra parte do corpo
    """

    def __init__(self, cabeca, direcao=DIREITA, tamanho=3):
        raise NotImplementedError("P2")


class Jogo:
    """O estado do jogo inteiro. estado é "a_jogar", "pausa", "perdeu" ou "ganhou".

    Jogo(largura=20, altura=15, semente=None):
      - self.rng = random.Random(semente)   (com a mesma semente, o jogo é sempre igual: testável!)
      - a cobra começa no centro (largura // 2, altura // 2), virada para a direita, com tamanho 3
      - self.pontos = 0, self.estado = "a_jogar"
      - self.comida = uma posição livre escolhida com self.rng.choice(livres(...))
    passo(): um "tique" do jogo. Só faz alguma coisa no estado "a_jogar":
      - se a próxima posição da cabeça sair da grelha: estado = "perdeu" (e a cobra não se mexe)
      - avança a cobra; cresce se a próxima posição for a comida
      - se a cobra colidir consigo própria: estado = "perdeu"
      - se comeu: +1 ponto e comida nova; se já não houver posições livres: estado = "ganhou"
    alternar_pausa(): "a_jogar" ↔ "pausa" (nos outros estados não faz nada)
    """

    def __init__(self, largura=20, altura=15, semente=None):
        raise NotImplementedError("P2")
