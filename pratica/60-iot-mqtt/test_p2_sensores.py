import pytest

from sensores import MediaMovel, Termostato, descodificar


def test_media_movel_com_janela():
    m = MediaMovel(3)
    assert [m.adicionar(v) for v in [10, 20, 30, 40, 50]] == [10.0, 15.0, 20.0, 30.0, 40.0]


def test_media_movel_de_uma_so_leitura_e_a_propria_leitura():
    m = MediaMovel(1)
    assert [m.adicionar(v) for v in [3, 7]] == [3.0, 7.0]


def test_media_movel_recusa_janelas_invalidas():
    with pytest.raises(ValueError):
        MediaMovel(0)


def test_termostato_com_histerese():
    t = Termostato(alvo=20, margem=0.5)
    leituras = [20.0, 19.4, 19.8, 20.4, 20.6, 20.0, 19.6, 19.5, 19.49]
    esperado = [False, True, True, True, False, False, False, False, True]
    assert [t.atualizar(v) for v in leituras] == esperado


def test_termostato_nao_oscila_com_ruido_a_volta_do_alvo():
    t = Termostato(alvo=20, margem=0.5)
    t.atualizar(19.0)  # liga
    estados = [t.atualizar(v) for v in [20.1, 19.9, 20.2, 19.8, 20.0]]
    assert estados == [True] * 5, "dentro da margem, o estado não devia mudar"


def test_descodificar_uma_leitura_valida():
    assert descodificar(b'{"sensor": "sala", "temperatura": 21.5}') == {"sensor": "sala", "temperatura": 21.5}


def test_descodificar_aceita_inteiros_e_ignora_campos_extra():
    r = descodificar('{"sensor": "sala", "temperatura": 21, "bateria": 80}'.encode())
    assert r == {"sensor": "sala", "temperatura": 21.0}
    assert isinstance(r["temperatura"], float)


def test_descodificar_aceita_utf8():
    assert descodificar('{"sensor": "cozinha-ção", "temperatura": 5}'.encode("utf-8"))["sensor"] == "cozinha-ção"


@pytest.mark.parametrize(
    "payload",
    [
        b"isto nao e json",
        b"\xff\xfe",                                         # nem sequer é UTF-8
        b"[1, 2]",                                           # JSON, mas não é um objeto
        b'{"temperatura": 20}',                              # falta o sensor
        b'{"sensor": "", "temperatura": 20}',
        b'{"sensor": 7, "temperatura": 20}',
        b'{"sensor": "sala"}',                               # falta a temperatura
        b'{"sensor": "sala", "temperatura": "20"}',
        b'{"sensor": "sala", "temperatura": true}',          # True é um int em Python!
        b'{"sensor": "sala", "temperatura": null}',
        b'{"sensor": "sala", "temperatura": -40.1}',
        b'{"sensor": "sala", "temperatura": 85.1}',
    ],
)
def test_descodificar_recusa_lixo(payload):
    with pytest.raises(ValueError):
        descodificar(payload)


def test_os_limites_do_sensor_sao_aceites():
    assert descodificar(b'{"sensor": "s", "temperatura": -40}')["temperatura"] == -40.0
    assert descodificar(b'{"sensor": "s", "temperatura": 85}')["temperatura"] == 85.0
