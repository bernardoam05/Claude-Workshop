# P3 · Um dispositivo IoT que fala com um broker MQTT a sério (o Mosquitto), com o paho-mqtt.
import json  # noqa: F401

import paho.mqtt.client as mqtt  # noqa: F401


class Dispositivo:
    """Um aquecedor ligado à rede, com o identificador `ident` (ex.: "sala").

    Tópicos (todos debaixo de casa/<ident>/):
      estado       "online" ou "offline", RETIDO (quem subscreve depois recebe o último valor)
      temperatura  JSON {"sensor": ident, "temperatura": valor}, QoS 1
      comandos     o dispositivo SUBSCREVE este tópico; recebe "ligar" ou "desligar"

    ligar(host, porta):
      - configura o LAST WILL: se a ligação cair sem aviso, o BROKER publica "offline" retido
        em casa/<ident>/estado (tem de ser configurado ANTES de ligar)
      - liga, arranca o ciclo de rede em segundo plano (loop_start), e espera até estar ligado
      - quando a ligação é aceite (on_connect): subscreve casa/<ident>/comandos com QoS 1 e
        publica "online" retido em casa/<ident>/estado
    publicar_temperatura(valor): publica com QoS 1 e espera que o broker confirme
    ao receber "ligar"/"desligar" em comandos: muda self.aquecimento (True/False); ignora o resto
    desligar(): publica "offline" retido, espera pela confirmação, e desliga de forma limpa

    Guarda o cliente do paho em self.cliente (um dos testes usa-o para simular uma falha de rede).
    """

    def __init__(self, ident: str):
        self.ident = ident
        self.aquecimento = False
        raise NotImplementedError("P3: cria aqui o cliente MQTT (paho-mqtt 2: CallbackAPIVersion.VERSION2)")

    def ligar(self, host: str, porta: int) -> None:
        raise NotImplementedError("P3")

    def publicar_temperatura(self, valor: float) -> None:
        raise NotImplementedError("P3")

    def desligar(self) -> None:
        raise NotImplementedError("P3")
