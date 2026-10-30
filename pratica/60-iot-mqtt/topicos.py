# P1 · Tópicos MQTT e wildcards. Ver docs/60-iot-mqtt.md, secção "Prática".
#
# Um tópico é um caminho com níveis separados por "/": casa/sala/temperatura
# Um FILTRO (o que se subscreve) pode ter wildcards:
#   +  substitui exatamente UM nível           casa/+/temperatura  →  casa/sala/temperatura
#   #  substitui ZERO ou mais níveis, no fim   casa/#              →  casa, casa/sala, casa/sala/luz
# Os tópicos começados por "$" (ex.: $SYS/broker/uptime) são do broker: um filtro que começa
# com + ou # NÃO os apanha.


def validar_filtro(filtro: str) -> None:
    """Lança ValueError se o filtro for inválido. É inválido se:
    - for vazio;
    - tiver um # que não seja o último nível, ou que não ocupe o nível inteiro (ex.: "casa#");
    - tiver um + que não ocupe o nível inteiro (ex.: "casa/sala+/luz")."""
    raise NotImplementedError("P1")


def corresponde(filtro: str, topico: str) -> bool:
    """True se o tópico for apanhado pelo filtro (que já foi validado)."""
    raise NotImplementedError("P1")
