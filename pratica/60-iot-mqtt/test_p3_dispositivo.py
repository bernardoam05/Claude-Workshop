import json

from conftest import esperar
from dispositivo import Dispositivo


def test_ao_ligar_anuncia_online_retido(broker, observador):
    d = Dispositivo("sala")
    d.ligar(*broker)
    try:
        # Um observador que só chega DEPOIS recebe na mesma o "online": é a mensagem retida.
        o = observador("casa/sala/estado")
        assert esperar(lambda: o.em("casa/sala/estado") == [("online", True)])
    finally:
        d.desligar()


def test_publica_a_temperatura_em_json(broker, observador):
    o = observador("casa/+/temperatura")
    d = Dispositivo("quarto")
    d.ligar(*broker)
    try:
        d.publicar_temperatura(19.5)
        assert esperar(lambda: len(o.em("casa/quarto/temperatura")) == 1)
        payload, retido = o.em("casa/quarto/temperatura")[0]
        assert json.loads(payload) == {"sensor": "quarto", "temperatura": 19.5}
        assert retido is False, "a temperatura não deve ser retida"
    finally:
        d.desligar()


def test_obedece_aos_comandos(broker, observador):
    d = Dispositivo("escritorio")
    d.ligar(*broker)
    controlo = observador("nada/#")
    try:
        controlo.publicar("casa/escritorio/comandos", "ligar")
        assert esperar(lambda: d.aquecimento is True)
        controlo.publicar("casa/escritorio/comandos", "explodir")   # comandos desconhecidos são ignorados
        controlo.publicar("casa/escritorio/comandos", "desligar")
        assert esperar(lambda: d.aquecimento is False)
        controlo.publicar("casa/outro/comandos", "ligar")          # só os SEUS comandos
        assert not esperar(lambda: d.aquecimento is True, segundos=0.5)
    finally:
        d.desligar()


def test_desligar_de_forma_limpa_publica_offline(broker, observador):
    d = Dispositivo("garagem")
    d.ligar(*broker)
    d.desligar()
    o = observador("casa/garagem/estado")
    assert esperar(lambda: o.em("casa/garagem/estado") == [("offline", True)])


def test_se_a_ligacao_cair_o_broker_publica_o_last_will(broker, observador):
    d = Dispositivo("cave")
    d.ligar(*broker)
    o = observador("casa/cave/estado")
    assert esperar(lambda: o.em("casa/cave/estado") == [("online", True)])
    # Simula uma falha de rede: a ligação TCP fecha-se SEM a mensagem DISCONNECT do MQTT.
    # O dispositivo não tem oportunidade de dizer nada: quem publica o "offline" é o broker.
    d.cliente.loop_stop()
    d.cliente.socket().close()
    assert esperar(lambda: ("offline", False) in o.em("casa/cave/estado")), "o broker não publicou o last will"
    # E ficou retido: quem chega depois também sabe que o dispositivo está offline.
    depois = observador("casa/cave/estado")
    assert esperar(lambda: depois.em("casa/cave/estado") == [("offline", True)])
