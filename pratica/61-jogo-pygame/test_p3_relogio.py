import pytest

from relogio import PassoFixo


def test_acumula_o_tempo_que_sobra():
    p = PassoFixo(10)
    assert [p.avancar(dt) for dt in [0.05, 0.05, 0.25, 0.05]] == [0, 1, 2, 1]


def test_dez_frames_de_um_decimo_dao_dez_passos_apesar_dos_arredondamentos():
    p = PassoFixo(10)
    assert sum(p.avancar(0.1) for _ in range(10)) == 10, "0.1 não é exato em binário: cuidado com as somas"


def test_a_60_fps_um_jogo_a_8_passos_por_segundo_da_8_passos_num_segundo():
    p = PassoFixo(8)
    assert sum(p.avancar(1 / 60) for _ in range(60)) == 8


def test_um_engasgo_nao_provoca_uma_avalanche_de_passos():
    p = PassoFixo(10, max_passos=5)
    assert p.avancar(3.0) == 5
    assert p.avancar(0.0) == 0, "o atraso que passou do máximo devia ter sido descartado"


@pytest.mark.parametrize("pps", [0, -1])
def test_recusa_ritmos_invalidos(pps):
    with pytest.raises(ValueError):
        PassoFixo(pps)
