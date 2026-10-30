import dataclasses

import pytest

from grelha import BAIXO, CIMA, DIREITA, ESQUERDA, Posicao, dentro, livres, opostas


def test_posicao_e_uma_dataclass_imutavel():
    p = Posicao(2, 3)
    assert dataclasses.is_dataclass(p) and (p.x, p.y) == (2, 3)
    with pytest.raises(dataclasses.FrozenInstanceError):
        p.x = 5


def test_posicoes_iguais_sao_iguais_e_cabem_num_set():
    assert Posicao(1, 1) == Posicao(1, 1)
    assert len({Posicao(1, 1), Posicao(1, 1), Posicao(2, 1)}) == 2


def test_mais_devolve_uma_posicao_nova():
    p = Posicao(2, 3)
    assert p.mais(CIMA) == Posicao(2, 2)
    assert p.mais(BAIXO) == Posicao(2, 4)
    assert p.mais(ESQUERDA) == Posicao(1, 3)
    assert p.mais(DIREITA) == Posicao(3, 3)
    assert p == Posicao(2, 3), "o mais() não pode alterar a posição original"


def test_opostas():
    assert opostas(CIMA, BAIXO) and opostas(ESQUERDA, DIREITA) and opostas(DIREITA, ESQUERDA)
    assert not opostas(CIMA, CIMA) and not opostas(CIMA, DIREITA)


def test_dentro():
    assert dentro(Posicao(0, 0), 3, 2) and dentro(Posicao(2, 1), 3, 2)
    assert not dentro(Posicao(3, 0), 3, 2) and not dentro(Posicao(0, 2), 3, 2)
    assert not dentro(Posicao(-1, 0), 3, 2)


def test_livres_por_linhas():
    assert livres(3, 2, {Posicao(1, 0), Posicao(0, 1)}) == [Posicao(0, 0), Posicao(2, 0), Posicao(1, 1), Posicao(2, 1)]
    assert livres(2, 1, [Posicao(0, 0), Posicao(1, 0)]) == []
