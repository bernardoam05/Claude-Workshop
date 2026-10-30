import json

from central import Central
from conftest import esperar


def temperatura(ident, valor):
    return json.dumps({"sensor": ident, "temperatura": valor})


def test_junta_as_temperaturas_e_os_estados_de_todos(broker, observador):
    c = Central()
    c.ligar(*broker)
    pub = observador("nada/#")
    try:
        pub.publicar("casa/sala/estado", "online", retain=True)
        pub.publicar("casa/quarto/estado", "online", retain=True)
        pub.publicar("casa/sala/temperatura", temperatura("sala", 20.0))
        pub.publicar("casa/quarto/temperatura", temperatura("quarto", 18.0))
        pub.publicar("casa/sala/temperatura", temperatura("sala", 21.0))   # a última é a que conta
        assert esperar(lambda: c.resumo() == {"online": ["quarto", "sala"], "media": 19.5})
        pub.publicar("casa/quarto/estado", "offline", retain=True)
        assert esperar(lambda: c.resumo()["online"] == ["sala"])
    finally:
        c.desligar()
        pub.publicar("casa/sala/estado", "", retain=True)     # uma mensagem retida vazia apaga a retida
        pub.publicar("casa/quarto/estado", "", retain=True)


def test_sem_leituras_a_media_e_none(broker):
    c = Central()
    c.ligar(*broker)
    try:
        assert c.resumo()["media"] is None
    finally:
        c.desligar()


def test_mensagens_invalidas_sao_contadas_e_nao_derrubam_a_central(broker, observador):
    c = Central()
    c.ligar(*broker)
    pub = observador("nada/#")
    try:
        pub.publicar("casa/sala/temperatura", "lixo")
        pub.publicar("casa/sala/temperatura", temperatura("sala", 999))
        pub.publicar("casa/sala/temperatura", temperatura("sala", 22.26))
        assert esperar(lambda: c.resumo()["media"] == 22.3)
        assert c.rejeitadas == 2
    finally:
        c.desligar()


def test_recebe_o_estado_retido_de_quem_ligou_antes(broker, observador):
    pub = observador("nada/#")
    pub.publicar("casa/antigo/estado", "online", retain=True)
    c = Central()
    c.ligar(*broker)
    try:
        assert esperar(lambda: "antigo" in c.resumo()["online"])
    finally:
        c.desligar()
        pub.publicar("casa/antigo/estado", "", retain=True)
