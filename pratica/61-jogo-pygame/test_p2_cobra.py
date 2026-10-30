from cobra import Cobra, Jogo
from grelha import BAIXO, CIMA, DIREITA, ESQUERDA, Posicao


def corpo(cobra):
    return [(p.x, p.y) for p in cobra.corpo]


def test_a_cobra_nasce_com_o_corpo_atras_da_cabeca():
    assert corpo(Cobra(Posicao(5, 5))) == [(5, 5), (4, 5), (3, 5)]
    assert corpo(Cobra(Posicao(5, 5), direcao=CIMA, tamanho=2)) == [(5, 5), (5, 6)]
    assert Cobra(Posicao(5, 5)).cabeca == Posicao(5, 5)


def test_avancar_move_sem_crescer():
    c = Cobra(Posicao(5, 5))
    c.avancar()
    assert corpo(c) == [(6, 5), (5, 5), (4, 5)]


def test_avancar_a_crescer_mantem_a_cauda():
    c = Cobra(Posicao(5, 5))
    c.avancar(crescer=True)
    assert corpo(c) == [(6, 5), (5, 5), (4, 5), (3, 5)]


def test_virar_e_nao_poder_voltar_para_tras():
    c = Cobra(Posicao(5, 5))
    c.virar(ESQUERDA)                    # oposta à direita: ignorado
    c.avancar()
    assert c.cabeca == Posicao(6, 5)
    c.virar(BAIXO)
    c.avancar()
    assert c.cabeca == Posicao(6, 6)


def test_duas_teclas_antes_de_avancar_nao_a_viram_para_tras():
    c = Cobra(Posicao(5, 5))             # a andar para a direita
    c.virar(CIMA)
    c.virar(ESQUERDA)                    # oposta ao ÚLTIMO AVANÇO (direita): ignorado
    c.avancar()
    assert c.cabeca == Posicao(5, 4), "a cobra devia subir, e não voltar para trás sobre si própria"


def test_colide_consigo():
    c = Cobra(Posicao(5, 5), tamanho=5)
    assert not c.colide_consigo()
    for d in [BAIXO, ESQUERDA, CIMA]:    # um quadrado apertado: a cabeça bate no próprio corpo
        c.virar(d)
        c.avancar()
    assert c.colide_consigo()


def test_o_jogo_comeca_no_centro():
    j = Jogo(largura=10, altura=8, semente=1)
    assert j.cobra.cabeca == Posicao(5, 4) and len(j.cobra.corpo) == 3
    assert j.estado == "a_jogar" and j.pontos == 0
    assert j.comida not in j.cobra.corpo


def test_a_mesma_semente_da_o_mesmo_jogo():
    assert Jogo(semente=42).comida == Jogo(semente=42).comida


def test_comer_da_pontos_faz_crescer_e_poe_comida_nova():
    j = Jogo(largura=10, altura=8, semente=1)
    j.comida = Posicao(6, 4)             # mesmo à frente da cabeça
    j.passo()
    assert j.pontos == 1 and len(j.cobra.corpo) == 4
    assert j.comida != Posicao(6, 4) and j.comida not in j.cobra.corpo


def test_bater_na_parede_perde():
    j = Jogo(largura=6, altura=4, semente=1)   # cabeça em (3, 2), a andar para a direita
    j.comida = Posicao(0, 0)
    j.passo()
    j.passo()                                   # (5, 2): ainda dentro
    assert j.estado == "a_jogar"
    j.passo()                                   # (6, 2): fora
    assert j.estado == "perdeu"
    assert j.cobra.cabeca == Posicao(5, 2), "ao perder contra a parede, a cobra não sai da grelha"


def test_depois_de_perder_o_passo_nao_faz_nada():
    j = Jogo(largura=6, altura=4, semente=1)
    j.estado = "perdeu"
    antes = list(j.cobra.corpo)
    j.passo()
    assert j.cobra.corpo == antes


def test_pausa():
    j = Jogo(semente=1)
    j.alternar_pausa()
    assert j.estado == "pausa"
    antes = j.cobra.cabeca
    j.passo()
    assert j.cobra.cabeca == antes, "em pausa, a cobra não se mexe"
    j.alternar_pausa()
    assert j.estado == "a_jogar"


def test_morder_a_propria_cauda_que_vai_sair_e_permitido():
    # Uma cobra de 4 em quadrado: a cabeça vai para onde está a ponta da cauda, que sai no mesmo passo.
    j = Jogo(largura=10, altura=10, semente=1)
    j.cobra.corpo = [Posicao(5, 5), Posicao(5, 6), Posicao(6, 6), Posicao(6, 5)]
    j.cobra.virar(DIREITA)
    j.comida = Posicao(0, 0)
    j.passo()
    assert j.estado == "a_jogar"


def test_encher_a_grelha_toda_ganha():
    j = Jogo(largura=4, altura=1, semente=1)
    j.cobra.corpo = [Posicao(2, 0), Posicao(1, 0), Posicao(0, 0)]
    j.comida = Posicao(3, 0)
    j.passo()
    assert j.estado == "ganhou" and j.pontos == 1
