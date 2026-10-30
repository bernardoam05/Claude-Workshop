import pytest

from topicos import corresponde, validar_filtro


@pytest.mark.parametrize("filtro", ["casa/sala/temperatura", "casa/+/temperatura", "casa/#", "#", "+", "+/+", "casa/+/#", "/casa"])
def test_filtros_validos(filtro):
    validar_filtro(filtro)


@pytest.mark.parametrize("filtro", ["", "casa/#/luz", "casa#", "casa/sala+/luz", "+casa", "#/x"])
def test_filtros_invalidos(filtro):
    with pytest.raises(ValueError):
        validar_filtro(filtro)


@pytest.mark.parametrize(
    "filtro, topico, esperado",
    [
        ("casa/sala/temperatura", "casa/sala/temperatura", True),
        ("casa/sala/temperatura", "casa/sala/humidade", False),
        ("casa/sala/temperatura", "Casa/sala/temperatura", False),   # maiúsculas contam
        ("casa/+/temperatura", "casa/cozinha/temperatura", True),
        ("casa/+/temperatura", "casa/temperatura", False),            # + é exatamente UM nível
        ("casa/+/temperatura", "casa/r/c/temperatura", False),
        ("casa/+", "casa/", True),                                     # um nível vazio também é um nível
        ("casa/#", "casa", True),                                      # # inclui o próprio nível pai
        ("casa/#", "casa/sala/luz/estado", True),
        ("casa/#", "casota/sala", False),
        ("#", "qualquer/coisa", True),
        ("+/+", "a/b", True),
        ("+/+", "a/b/c", False),
        ("#", "$SYS/broker/uptime", False),                           # tópicos $ do broker ficam de fora
        ("+/broker/uptime", "$SYS/broker/uptime", False),
        ("$SYS/#", "$SYS/broker/uptime", True),
    ],
)
def test_corresponde(filtro, topico, esperado):
    assert corresponde(filtro, topico) is esperado, f"{filtro!r} vs {topico!r}"
