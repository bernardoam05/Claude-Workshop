# P3 · O passo fixo: a lógica do jogo avança a um ritmo constante, seja qual for a velocidade
# a que o ecrã é desenhado.


class PassoFixo:
    """PassoFixo(passos_por_segundo, max_passos=5)

    avancar(dt): recebe os segundos REAIS que passaram desde a última chamada e devolve QUANTOS
    passos de lógica correr agora. Guarda o tempo que "sobra" para a próxima chamada.

      p = PassoFixo(10)          # um passo a cada 0,1 s
      p.avancar(0.05) → 0        (sobra 0,05)
      p.avancar(0.05) → 1        (0,05 + 0,05 = 0,1)
      p.avancar(0.25) → 2        (sobra 0,05)

    Se o computador "engasgar" (dt enorme), devolve no máximo max_passos e DESCARTA o resto:
    sem isto, o jogo tentava recuperar o atraso todo de uma vez e ficava cada vez mais atrasado.
    """

    def __init__(self, passos_por_segundo: float, max_passos: int = 5):
        raise NotImplementedError("P3")

    def avancar(self, dt: float) -> int:
        raise NotImplementedError("P3")
