# P2 · Processar leituras de sensores: os dados de dispositivos reais são ruidosos e às vezes lixo.
import json  # noqa: F401 (vais precisar dele)


class MediaMovel:
    """A média das últimas `n` leituras. Suaviza o ruído de um sensor barato.

    m = MediaMovel(3); m.adicionar(10) → 10.0; m.adicionar(20) → 15.0; m.adicionar(30) → 20.0;
    m.adicionar(40) → 30.0 (a leitura 10 já saiu da janela).
    n tem de ser >= 1 (senão, ValueError)."""

    def __init__(self, n: int):
        raise NotImplementedError("P2")

    def adicionar(self, valor: float) -> float:
        raise NotImplementedError("P2")


class Termostato:
    """Liga o aquecimento abaixo de (alvo - margem) e desliga-o acima de (alvo + margem).
    ENTRE os dois limites, mantém o estado anterior: é a HISTERESE. Sem ela, com a temperatura a
    oscilar à volta do alvo, o aquecimento ligava e desligava a cada leitura.

    t = Termostato(alvo=20, margem=0.5)    # começa desligado
    t.atualizar(19.4) → True   (abaixo de 19.5: liga)
    t.atualizar(20.0) → True   (entre 19.5 e 20.5: mantém)
    t.atualizar(20.6) → False  (acima de 20.5: desliga)
    t.atualizar(20.0) → False  (mantém)"""

    def __init__(self, alvo: float, margem: float):
        raise NotImplementedError("P2")

    def atualizar(self, temperatura: float) -> bool:
        raise NotImplementedError("P2")


def descodificar(payload: bytes) -> dict:
    """Converte a mensagem de um sensor num dict {"sensor": str, "temperatura": float}.

    A mensagem é JSON em UTF-8, por exemplo b'{"sensor": "sala", "temperatura": 21.5}'.
    Lança ValueError se:
    - não for JSON válido, ou não for um objeto;
    - faltar "sensor" (ou não for uma string não vazia);
    - faltar "temperatura", ou não for um número (atenção: em Python, True é um int!);
    - a temperatura estiver fora de -40 a 85 °C (o intervalo do sensor: fora disso é avaria).
    Um int (21) é aceite e devolvido como float (21.0). Outros campos são ignorados."""
    raise NotImplementedError("P2")
