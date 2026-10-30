# P4 · A central: o lado do servidor, que ouve TODOS os dispositivos da casa.
import json  # noqa: F401
import threading  # noqa: F401

import paho.mqtt.client as mqtt  # noqa: F401

from sensores import descodificar  # noqa: F401 (a validação do P2, reutilizada)


class Central:
    """Subscreve casa/+/temperatura e casa/+/estado (QoS 1) e mantém, em memória:
      - self.ultimas: {ident: última temperatura válida}
      - self.online:  o set dos dispositivos cujo último estado é "online"
      - self.rejeitadas: quantas mensagens de temperatura foram descartadas por serem inválidas
    O ident é o 2.º nível do tópico (casa/<ident>/...). Uma mensagem inválida NUNCA pode
    derrubar a central: é contada e ignorada.

    ligar(host, porta): liga, subscreve (no on_connect) e espera até a subscrição estar ativa
    resumo(): {"online": [idents ordenados], "media": média das últimas temperaturas, arredondada
               a 1 casa decimal (None se não houver nenhuma)}
    desligar(): desliga de forma limpa
    Os callbacks do paho correm noutra thread: protege os dados com um threading.Lock."""

    def __init__(self):
        raise NotImplementedError("P4")

    def ligar(self, host: str, porta: int) -> None:
        raise NotImplementedError("P4")

    def resumo(self) -> dict:
        raise NotImplementedError("P4")

    def desligar(self) -> None:
        raise NotImplementedError("P4")
