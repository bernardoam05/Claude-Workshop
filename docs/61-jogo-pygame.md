# 61 · Um jogo com pygame: arquitetura de uma aplicação em tempo real

**Objetivo:** fazer um jogo completo (a Cobra, o clássico *Snake*) e, com ele, aprender coisas que um backend não ensina: o ciclo de jogo, o tempo (FPS, passo fixo), o estado e a máquina de estados, o input em tempo real. E, sobretudo, uma lição de arquitetura que vale para tudo o que já fizeste: **separar as regras da apresentação**, para que as regras se possam testar sem ecrã.

**Ficheiros para ler:** os da prática, em `pratica/61-jogo-pygame/`. A sintaxe de Python está no módulo 31, secção 2.

**Pré-requisitos:** módulo 31 (Python). O módulo 08 (React) ajuda na secção 2.

---

## 1. Porquê um jogo

Um jogo pequeno junta, em poucas centenas de linhas, problemas que noutras aplicações aparecem espalhados e diluídos:

- **tempo real:** o programa não espera por um pedido; tem de fazer algo 60 vezes por segundo;
- **estado que muda sozinho:** a cobra anda mesmo que ninguém carregue em nada;
- **input imprevisível:** o jogador carrega em duas teclas no mesmo instante;
- **aleatoriedade:** a comida aparece num sítio diferente em cada jogo, mas os testes precisam de resultados sempre iguais.

E obriga a pensar em arquitetura: se as regras do jogo estiverem misturadas com o desenho, não as consegues testar, nem reutilizar (num servidor de multijogador, numa IA que joga sozinha, numa versão web).

## 2. O ciclo de jogo

Um servidor web passa a vida à espera de pedidos. Um jogo corre um ciclo infinito, e cada volta é um **frame**:

```python
while a_correr:
    tratar_input()      # 1. que teclas foram carregadas desde o último frame?
    atualizar()         # 2. avançar as regras: mover, colidir, pontuar
    desenhar()          # 3. pintar o estado atual no ecrã
    esperar()           # 4. abrandar até ao próximo frame (ex.: 1/60 s)
```

Compara com o que já conheces:

- O **event loop do Node** (módulo 01) também é um ciclo, mas só faz trabalho quando chega um evento. O ciclo de jogo faz trabalho em **todas** as voltas, haja input ou não.
- No **React** (módulo 08), o desenho é uma função do estado: `UI = f(estado)`. Num jogo é igual: o `desenhar()` não decide nada, só mostra o estado. A diferença é que o React só volta a desenhar quando o estado muda, e o jogo desenha sempre.

## 3. Tempo: FPS, delta time e passo fixo

Se a cobra andar uma casa **por frame**, num computador a 144 FPS anda mais do dobro da velocidade do que num a 60 FPS, e num portátil que engasga anda aos solavancos. A velocidade do jogo não pode depender da velocidade do ecrã.

Há duas soluções clássicas:

**Delta time:** cada frame mede quanto tempo real passou (`dt`) e move as coisas proporcionalmente: `posicao += velocidade * dt`. Serve para movimentos contínuos (uma nave, uma bola). O problema: a física passa a depender de `dt`, e com `dt` grandes as colisões falham (a bola atravessa a parede de um frame para o outro).

**Passo fixo** (*fixed timestep*): as regras avançam sempre em passos de tamanho igual (aqui, 1/8 s), e o desenho corre à velocidade que conseguir. Um **acumulador** junta o tempo real e, quando chega a um passo, corre-o:

```
frame a frame (60 FPS, dt ≈ 0,0167 s; passo = 0,125 s):
acumulado: 0,017 → 0,033 → ... → 0,133  → corre 1 passo, sobra 0,008 → ...
```

É o que o `PassoFixo` do P3 faz, e é o que se usa em jogos com regras discretas (como a Cobra, que anda casa a casa) e em jogos em rede (todos os jogadores têm de calcular os mesmos passos). Há um cuidado: se o computador parar um segundo (outro programa, um *breakpoint*), o acumulador fica com 8 passos de atraso. Correr os 8 de uma vez demora, o que atrasa o frame seguinte, que acumula mais... É a "espiral da morte", e evita-se com um **máximo de passos por frame**, descartando o resto.

Há ainda os números com vírgula: somar `1/60` sessenta vezes não dá exatamente `1.0` em binário. Sem uma pequena margem nas contas, perdes um passo por segundo. Os testes do P3 apanham isto.

## 4. A arquitetura: regras de um lado, ecrã do outro

O jogo da prática está em quatro ficheiros, e as dependências só apontam num sentido:

```
principal.py   ← pygame: teclado, desenho, janela, o ciclo        (só ESTE importa o pygame)
    │ usa
    ├──▶ relogio.py   ← o passo fixo                               (Python puro)
    └──▶ cobra.py     ← as regras: Cobra, Jogo, estados             (Python puro)
              │ usa
              └──▶ grelha.py  ← posições e direções                 (Python puro)
```

É a mesma separação do módulo 04 (as *routes* conhecem o HTTP, os *services* não) e da arquitetura hexagonal: o núcleo (as regras) não sabe nada da interface. O que se ganha:

- **Testes rápidos e exatos:** o `Jogo` testa-se com `j.passo()` e `assert j.estado == "perdeu"`, sem janela, sem esperar, sem sorte.
- **Trocar a interface:** a mesma `cobra.py` serviria para uma versão no terminal, para um bot que joga sozinho, ou para um servidor que corre o jogo e envia o estado a vários jogadores.
- **Raciocinar por partes:** um bug no desenho não está nas regras, e vice-versa.

A regra prática: se um ficheiro de regras precisa de `import pygame`, alguma coisa está no sítio errado.

## 5. Estado e máquina de estados

Um jogo está sempre num de poucos **estados**, e cada um reage às coisas de forma diferente:

```
            P / espaço               bate na parede ou em si
 ┌──────────┐ ───────▶ ┌───────┐    ┌────────────────────┐
 │ a_jogar  │          │ pausa │    │                    ▼
 │          │ ◀─────── │       │    │              ┌──────────┐  Enter   ┌──────────────┐
 └──────────┘  P / esp. └───────┘    └───── a_jogar │  perdeu  │ ───────▶ │ Jogo novo    │
      │ enche a grelha                               └──────────┘          │ (a_jogar)    │
      ▼                                                                    └──────────────┘
 ┌──────────┐  Enter
 │  ganhou  │ ───────▶ Jogo novo
 └──────────┘
```

Escrever os estados explicitamente (uma string ou um `Enum`, e um `if` em cada operação) evita os bugs típicos de quem usa vários booleanos (`a_jogar`, `em_pausa`, `perdeu`): o que acontece se `em_pausa` e `perdeu` forem os dois `True`? Com um único `estado`, essa combinação impossível nem se consegue representar.

Os jogos maiores organizam-se em **cenas** (menu, nível 1, nível 2, ecrã final), cada uma com o seu input, atualização e desenho, e uma máquina de estados que troca entre elas. É a mesma ideia, um nível acima.

## 6. O pygame em 10 funções

O **pygame** é uma biblioteca de Python sobre o SDL (a mesma biblioteca em C que muitos jogos comerciais usam para janelas, teclado e som). A prática usa o **pygame-ce** (*community edition*), a versão mantida pela comunidade, que se importa da mesma forma: `import pygame`.

```python
import pygame

pygame.init()
ecra = pygame.display.set_mode((640, 480))      # a janela; devolve uma Surface (uma imagem onde se desenha)
pygame.display.set_caption("Cobra")
relogio = pygame.time.Clock()
fonte = pygame.font.Font(None, 28)               # None = a fonte por omissão

while True:
    for evento in pygame.event.get():            # TODOS os eventos desde o último frame
        if evento.type == pygame.QUIT:            # o X da janela
            ...
        if evento.type == pygame.KEYDOWN and evento.key == pygame.K_UP:
            ...

    ecra.fill((18, 18, 28))                                    # pinta tudo de uma cor (R, G, B)
    pygame.draw.rect(ecra, (220, 60, 60), pygame.Rect(48, 24, 24, 24))   # x, y, largura, altura
    pygame.draw.circle(ecra, (80, 200, 120), (100, 100), 12)
    texto = fonte.render("Pontos: 3", True, (240, 240, 240))  # o texto vira uma Surface
    ecra.blit(texto, (8, 8))                                    # "colar" uma Surface noutra

    pygame.display.flip()                         # mostra o que foi desenhado
    dt = relogio.tick(60) / 1000                  # espera para não passar dos 60 FPS; devolve os ms
```

Três coisas que surpreendem quem começa:

- **O y cresce para baixo.** `(0, 0)` é o canto superior esquerdo. Por isso `CIMA` é `(0, -1)`.
- **Desenha-se tudo, em todos os frames.** Não se "move" um retângulo: pinta-se o fundo por cima de tudo e volta-se a desenhar cada coisa na posição nova.
- **O `flip()` evita a cintilação.** Desenhas numa imagem escondida (*back buffer*), e o `flip()` troca-a com a que está no ecrã de uma só vez. Sem isso, verias o ecrã a meio de ser pintado (*double buffering*).

E uma regra que congela janelas: **tens de chamar o `pygame.event.get()` em todos os frames**, mesmo que não queiras eventos. Se não o fizeres, o sistema operativo acha que o programa deixou de responder.

## 7. Input: eventos e o bug das duas teclas

Há duas formas de ler o teclado:

- **Eventos** (`KEYDOWN`): "a tecla foi carregada agora". Para ações que acontecem uma vez: virar, pausar, disparar.
- **Estado** (`pygame.key.get_pressed()`): "a tecla está carregada neste momento". Para ações contínuas: acelerar enquanto a tecla estiver em baixo.

A Cobra tem um bug clássico, que o P2 te pede para evitar. A cobra anda para a direita. Entre dois passos, o jogador carrega em CIMA e logo a seguir em ESQUERDA (para fazer uma curva rápida). Se `virar()` só comparar com a **direção atual**, aceita CIMA (não é a oposta de DIREITA) e depois aceita ESQUERDA (não é a oposta de CIMA). No passo seguinte, a cobra anda para a esquerda, para cima do próprio pescoço, e perde. A correção é comparar com a direção do **último avanço**, e não com a última tecla.

## 8. Aleatoriedade que se pode repetir

A comida aparece num sítio aleatório. Mas um teste que depende da sorte é um teste que falha de vez em quando (um *flaky test*, módulo 11). A solução é um gerador de números aleatórios **próprio**, com uma **semente**:

```python
self.rng = random.Random(semente)      # com a mesma semente, a mesma sequência de "aleatórios"
self.rng.choice(livres)
```

Nos testes, `Jogo(semente=1)` dá sempre o mesmo jogo. Em produção, `semente=None` usa a hora e é imprevisível. Os jogos usam isto para coisas sérias: gravar uma partida (*replay*) é guardar a semente e as teclas, e os jogos em rede mandam a semente a todos os jogadores para todos verem o mesmo mundo.

## 9. Testar um jogo

Com a arquitetura da secção 4, a maior parte dos testes nem sabe que existe um ecrã: são testes às regras, rápidos e exatos. Para a parte que usa o pygame, o SDL tem um modo sem janela:

```python
os.environ["SDL_VIDEODRIVER"] = "dummy"     # antes de importar o pygame: desenha para a memória
```

O teste do P4 desenha num `pygame.Surface` e lê píxeis com `ecra.get_at((x, y))`: "no centro da célula da cabeça, a cor é a da cabeça". É o mesmo princípio dos testes de estilos do módulo 09 (medir o resultado, e não ler o código), e é assim que o CI de um jogo verifica que o desenho não se partiu.

O que continua a não se testar bem automaticamente: se o jogo é **divertido**. Para isso, joga-o.

## 10. Para onde ir a partir daqui

- **Dentro do pygame:** imagens (`pygame.image.load`), animações com sprites (`pygame.sprite.Sprite` e `Group`), colisões entre retângulos (`rect.colliderect`), som (`pygame.mixer`), e o [pygbag](https://pygame-web.github.io/), que põe um jogo pygame a correr no browser.
- **Arquitetura de jogos maiores:** o **ECS** (*Entity Component System*): em vez de classes com herança (`Inimigo(Personagem)`), entidades que são só um id, componentes que são só dados (posição, vida, sprite), e sistemas que processam todas as entidades com certos componentes. É assim que muitos motores modernos organizam milhares de objetos.
- **Motores:** o **Godot** (livre, com uma linguagem parecida com Python, o GDScript), o **Unity** (em C#, o que liga ao módulo 23) e o **Unreal** (C++). Todos têm, por dentro, o ciclo, o passo fixo e os estados deste módulo.
- **Ligar ao resto do workshop:** o jogo pode enviar a pontuação no fim para uma API (a do módulo 31, com um modelo `Pontuacao`), e mostrar o top 10. É um bom projeto para juntar tudo: Python, uma API, uma BD, e um cliente que não é um browser.

---

## Prática: escreve tu

A Cobra completa, em quatro camadas. As três primeiras são Python puro e testam-se sem ecrã; a última é o pygame: o teclado, o desenho e o ciclo principal. Os testes do P4 correm o pygame sem janela (`SDL_VIDEODRIVER=dummy`) e verificam a cor dos píxeis.

**Ficheiros:** `pratica/61-jogo-pygame/` (`grelha.py`, `cobra.py`, `relogio.py`, `principal.py`)

**Verificar:** `npm run verificar 61` (dentro de `pratica/`). Só um exercício: `npm run verificar 61 p1`, `... 61 p2`, `... 61 p3` ou `... 61 p4`. Faz-os por ordem: o `cobra.py` usa a `Posicao` do P1, e o P4 usa tudo.

**Jogar:** quando o P4 passar, dentro de `pratica/61-jogo-pygame/`: `../.venv/bin/python principal.py`. Setas ou WASD para virar, P ou espaço para pausar, Enter para recomeçar, Escape para sair.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · A grelha (≈20 min)

**Ficheiro:** `grelha.py`

Uma `Posicao` imutável e três funções sobre a grelha. Pequeno, mas tudo o resto assenta nele.

**Sintaxe que vais praticar:** `@dataclass(frozen=True)` com anotações de tipo, métodos numa dataclass, desempacotar tuplos (`dx, dy = direcao`), comparações encadeadas (`0 <= x < largura`), list comprehension com dois `for` e um `if`.

<details>
<summary>Pista</summary>

Uma dataclass escreve sozinha o `__init__`, o `__eq__` e, com `frozen=True`, o `__hash__`: é isso que permite pôr uma `Posicao` num `set`. Nas comprehensions, os `for` leem-se pela ordem em que os escreverias encaixados: `[... for y in range(altura) for x in range(largura)]` percorre uma linha inteira antes de passar à seguinte.
</details>

<details>
<summary>Solução de referência</summary>

```python
from dataclasses import dataclass

CIMA = (0, -1)
BAIXO = (0, 1)
ESQUERDA = (-1, 0)
DIREITA = (1, 0)


@dataclass(frozen=True)
class Posicao:
    x: int
    y: int

    def mais(self, direcao):
        dx, dy = direcao
        return Posicao(self.x + dx, self.y + dy)


def opostas(a, b) -> bool:
    return a[0] == -b[0] and a[1] == -b[1]


def dentro(pos, largura: int, altura: int) -> bool:
    return 0 <= pos.x < largura and 0 <= pos.y < altura


def livres(largura: int, altura: int, ocupadas) -> list:
    ocupadas = set(ocupadas)   # "in" num set é imediato; numa lista, percorria-a toda
    return [Posicao(x, y) for y in range(altura) for x in range(largura) if Posicao(x, y) not in ocupadas]
```
</details>

### P2 · As regras: a Cobra e o Jogo (≈45 min)

**Ficheiro:** `cobra.py`

O coração do jogo, sem uma única linha de pygame: o corpo da cobra, virar sem voltar para trás (com o bug das duas teclas da secção 7), crescer, colidir, a comida aleatória com semente, e a máquina de estados da secção 5. Os testes incluem os casos de canto: morder a ponta da cauda que está a sair no mesmo passo é permitido, e encher a grelha toda é ganhar.

**Sintaxe que vais praticar:** classes com estado, `@property`, `list.insert` e `list.pop`, fatias (`corpo[1:]`), `random.Random(semente)` e `.choice`, `return` antecipado.

<details>
<summary>Pista</summary>

Guarda duas direções na `Cobra`: a **pedida** (muda com `virar`) e a do **último avanço** (muda no `avancar`). O `virar` compara com a segunda. No `Jogo.passo`, a ordem importa: primeiro a parede (antes de mexer), depois avançar, e só depois a colisão consigo própria. Assim, quando a cabeça vai para onde estava a ponta da cauda, a cauda já saiu.
</details>

<details>
<summary>Solução de referência</summary>

```python
import random

from grelha import DIREITA, Posicao, dentro, livres, opostas


class Cobra:
    def __init__(self, cabeca, direcao=DIREITA, tamanho=3):
        dx, dy = direcao
        self.corpo = [Posicao(cabeca.x - i * dx, cabeca.y - i * dy) for i in range(tamanho)]
        self.direcao = direcao
        self._ultima = direcao   # a direção do último avanço (é contra ESTA que se compara)

    @property
    def cabeca(self):
        return self.corpo[0]

    def virar(self, direcao):
        if not opostas(direcao, self._ultima):
            self.direcao = direcao

    def avancar(self, crescer=False):
        self.corpo.insert(0, self.cabeca.mais(self.direcao))
        if not crescer:
            self.corpo.pop()
        self._ultima = self.direcao

    def colide_consigo(self):
        return self.cabeca in self.corpo[1:]


class Jogo:
    def __init__(self, largura=20, altura=15, semente=None):
        self.largura = largura
        self.altura = altura
        self.rng = random.Random(semente)
        self.cobra = Cobra(Posicao(largura // 2, altura // 2))
        self.pontos = 0
        self.estado = "a_jogar"
        self.comida = self._nova_comida()

    def _nova_comida(self):
        possiveis = livres(self.largura, self.altura, self.cobra.corpo)
        return self.rng.choice(possiveis) if possiveis else None

    def passo(self):
        if self.estado != "a_jogar":
            return
        proxima = self.cobra.cabeca.mais(self.cobra.direcao)
        if not dentro(proxima, self.largura, self.altura):
            self.estado = "perdeu"
            return
        comeu = proxima == self.comida
        self.cobra.avancar(crescer=comeu)
        # Verificado DEPOIS de avançar: a ponta da cauda já saiu, por isso ir para onde ela estava é permitido.
        if self.cobra.colide_consigo():
            self.estado = "perdeu"
            return
        if comeu:
            self.pontos += 1
            self.comida = self._nova_comida()
            if self.comida is None:
                self.estado = "ganhou"

    def alternar_pausa(self):
        if self.estado == "a_jogar":
            self.estado = "pausa"
        elif self.estado == "pausa":
            self.estado = "a_jogar"
```
</details>

### P3 · O passo fixo (≈20 min)

**Ficheiro:** `relogio.py`

O acumulador da secção 3, com o limite contra a espiral da morte. Os testes incluem o caso real do P4 (60 FPS e 8 passos por segundo) e um "engasgo" de 3 segundos.

**Sintaxe que vais praticar:** atributos privados por convenção (`self._acumulado`), `int()` para truncar, `+=` e `-=` com números com vírgula, `raise ValueError`.

<details>
<summary>Pista</summary>

Guarda o período (`1 / passos_por_segundo`) em vez do ritmo: as contas ficam mais simples. Em cada chamada, soma o `dt`, calcula quantos períodos inteiros cabem, e subtrai-os. Se não passares no teste dos 60 FPS, lê outra vez o fim da secção 3.
</details>

<details>
<summary>Solução de referência</summary>

```python
class PassoFixo:
    def __init__(self, passos_por_segundo: float, max_passos: int = 5):
        if passos_por_segundo <= 0:
            raise ValueError("o ritmo tem de ser positivo")
        self.periodo = 1 / passos_por_segundo
        self.max_passos = max_passos
        self._acumulado = 0.0

    def avancar(self, dt: float) -> int:
        self._acumulado += dt
        # O 1e-9 absorve os erros de arredondamento dos números com vírgula: somar 1/60 sessenta
        # vezes, a 8 passos por segundo, dá 7 passos em vez de 8 sem esta margem.
        passos = int((self._acumulado + 1e-9) / self.periodo)
        if passos > self.max_passos:
            self._acumulado = 0.0          # descarta o atraso: mais vale saltar do que nunca recuperar
            return self.max_passos
        self._acumulado -= passos * self.periodo
        return passos
```
</details>

### P4 · O pygame: teclado, desenho e o ciclo (≈45 min)

**Ficheiro:** `principal.py`

As constantes (tamanho das células, cores, teclas) já lá estão. Escreves as três funções: traduzir eventos em ações, desenhar um frame, e o ciclo principal que junta tudo. Os testes desenham num ecrã em memória e verificam as cores das células, o texto dos pontos e a mensagem de fim; o último corre o ciclo durante 40 frames e confirma que a cobra andou.

**Sintaxe que vais praticar:** `pygame.init`, `display.set_mode`, `event.get` e `evento.type`/`evento.key`, `Surface.fill`, `pygame.Rect`, `draw.rect`, `font.Font` e `render`, `blit`, `get_rect(center=...)`, `time.Clock().tick`, `display.flip`, `pygame.quit`, e o `if __name__ == "__main__":`.

<details>
<summary>Pista</summary>

Para centrar um texto: `imagem = fonte.render(...)`, depois `imagem.get_rect(center=ecra.get_rect().center)` dá-te o retângulo onde a colar. No ciclo, o `relogio.tick(FPS)` devolve **milissegundos**: divide por 1000 antes de o dares ao `PassoFixo`. As direções são tuplos e as outras ações são strings: `isinstance(acao, tuple)` distingue-as.
</details>

<details>
<summary>Solução de referência</summary>

```python
import pygame

from cobra import Jogo
from grelha import BAIXO, CIMA, DIREITA, ESQUERDA
from relogio import PassoFixo

CELULA = 24
PASSOS_POR_SEGUNDO = 8
FPS = 60

CORES = {
    "fundo": (18, 18, 28),
    "cobra": (80, 200, 120),
    "cabeca": (40, 150, 90),
    "comida": (220, 60, 60),
    "texto": (240, 240, 240),
}

TECLAS = {
    pygame.K_UP: CIMA, pygame.K_w: CIMA,
    pygame.K_DOWN: BAIXO, pygame.K_s: BAIXO,
    pygame.K_LEFT: ESQUERDA, pygame.K_a: ESQUERDA,
    pygame.K_RIGHT: DIREITA, pygame.K_d: DIREITA,
}


def traduzir_evento(evento):
    if evento.type == pygame.QUIT:
        return "sair"
    if evento.type != pygame.KEYDOWN:
        return None
    if evento.key == pygame.K_ESCAPE:
        return "sair"
    if evento.key in TECLAS:
        return TECLAS[evento.key]
    if evento.key in (pygame.K_p, pygame.K_SPACE):
        return "pausa"
    if evento.key == pygame.K_RETURN:
        return "recomecar"
    return None


def _celula(pos):
    return pygame.Rect(pos.x * CELULA, pos.y * CELULA, CELULA, CELULA)


def _centrado(ecra, fonte, texto):
    imagem = fonte.render(texto, True, CORES["texto"])       # True = antialiasing
    ecra.blit(imagem, imagem.get_rect(center=ecra.get_rect().center))


def desenhar(ecra, jogo, fonte):
    ecra.fill(CORES["fundo"])
    if jogo.comida is not None:
        pygame.draw.rect(ecra, CORES["comida"], _celula(jogo.comida))
    for i, pos in enumerate(jogo.cobra.corpo):
        pygame.draw.rect(ecra, CORES["cabeca"] if i == 0 else CORES["cobra"], _celula(pos))
    ecra.blit(fonte.render(f"Pontos: {jogo.pontos}", True, CORES["texto"]), (8, 8))
    if jogo.estado == "perdeu":
        _centrado(ecra, fonte, "Fim! Enter para recomeçar")
    elif jogo.estado == "pausa":
        _centrado(ecra, fonte, "Pausa")


def correr(max_frames=None):
    pygame.init()
    jogo = Jogo()
    ecra = pygame.display.set_mode((jogo.largura * CELULA, jogo.altura * CELULA))
    pygame.display.set_caption("Cobra")
    fonte = pygame.font.Font(None, 28)
    relogio = pygame.time.Clock()
    passo = PassoFixo(PASSOS_POR_SEGUNDO)

    frames = 0
    a_correr = True
    while a_correr and (max_frames is None or frames < max_frames):
        # 1. Entrada: TODOS os eventos deste frame (senão, a fila do sistema enche e a janela "congela")
        for evento in pygame.event.get():
            acao = traduzir_evento(evento)
            if acao == "sair":
                a_correr = False
            elif acao == "pausa":
                jogo.alternar_pausa()
            elif acao == "recomecar" and jogo.estado in ("perdeu", "ganhou"):
                jogo = Jogo()
            elif isinstance(acao, tuple):
                jogo.cobra.virar(acao)

        # 2. Lógica: ao ritmo fixo, independente dos FPS. tick() espera o necessário e devolve os ms.
        dt = relogio.tick(FPS) / 1000
        for _ in range(passo.avancar(dt)):
            jogo.passo()

        # 3. Desenho: tudo numa superfície escondida, e o flip mostra-a de uma vez (sem cintilação)
        desenhar(ecra, jogo, fonte)
        pygame.display.flip()
        frames += 1

    pygame.quit()
    return jogo


if __name__ == "__main__":
    correr()
```
</details>

**Depois de passar: joga.** E depois melhora-o, sem partir os testes. Algumas ideias, da mais fácil à mais trabalhosa:

1. A velocidade aumenta a cada 5 pontos (um `PassoFixo` novo, com mais passos por segundo).
2. Um recorde guardado num ficheiro JSON, mostrado no ecrã de fim.
3. Uma comida dourada, que aparece de vez em quando e vale 3 pontos.
4. Um ecrã de menu antes de começar: um estado novo na máquina de estados, com o seu próprio desenho.
5. Enviar a pontuação para uma API em Django (módulo 31) e mostrar o top 10 da semana.

Para cada ideia, pergunta primeiro: isto é uma **regra** (vai para o `cobra.py`, com um teste) ou **apresentação** (vai para o `principal.py`)?

## Experiências

1. **Velocidade dependente dos FPS:** no `correr`, troca o ciclo do `PassoFixo` por um `jogo.passo()` por frame, e muda o `FPS` entre 10 e 60. Repara como a velocidade da cobra muda. Volta ao passo fixo e repete: a cobra anda igual.
2. **A espiral da morte:** acrescenta um `time.sleep(1)` dentro do ciclo, de 50 em 50 frames, e põe o `max_passos` a 1000. A cobra dá saltos de 8 casas. Com o `max_passos` a 5, o jogo apenas abranda.
3. **O bug das duas teclas:** no `virar`, compara com `self.direcao` em vez de `self._ultima`. Corre os testes do P2 e lê qual falha. Depois joga e tenta provocá-lo com uma curva rápida.
4. **Sem `event.get()`:** comenta o ciclo de eventos (`for evento in pygame.event.get(): ...`) e corre o jogo. Tenta fechar a janela. Ao fim de uns segundos, o sistema operativo diz que o programa não está a responder.

## Perguntas de pensamento crítico

1. Porque é que o ficheiro das regras (`cobra.py`) não pode importar o pygame? Dá dois exemplos concretos do que perderias se o fizesse.
2. Num jogo de corridas com física (velocidade, atrito, colisões), usarias delta time ou passo fixo para a física? E para o desenho?
3. Numa versão multijogador, dois jogadores em computadores diferentes têm de ver a mesma comida no mesmo sítio. Como usarias o que aprendeste na secção 8?

<details>
<summary>Respostas</summary>

1. Perderias os testes rápidos e exatos: para testar uma colisão terias de abrir uma janela (ou configurar o modo `dummy`) e simular frames. E perderias a reutilização: as mesmas regras não poderiam correr num servidor de multijogador (sem ecrã), numa versão de terminal, ou num bot que joga milhões de partidas para aprender. Uma dependência numa biblioteca de interface "contamina" tudo o que depende de ti.
2. Passo fixo para a física: os resultados ficam iguais em qualquer computador, as colisões não falham com frames lentos, e é a base para replays e jogos em rede. Para o desenho, o ritmo que o ecrã aguentar; os jogos mais cuidados até **interpolam** entre os dois últimos passos de física, para o movimento parecer suave a 144 FPS com a física a 60.
3. O servidor escolhe a semente no início da partida e envia-a aos dois. Como ambos usam `random.Random(semente)` e chamam o gerador pela mesma ordem (com o passo fixo, os passos são iguais nos dois), a comida aparece no mesmo sítio sem ser preciso enviá-la pela rede. Basta trocar as teclas de cada jogador. É a técnica *lockstep*, usada em jogos de estratégia.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 61`.

**1.** Porque é que a Cobra não deve andar uma casa por frame?

- a) Porque o pygame não permite
- b) Porque a velocidade do jogo passaria a depender dos FPS do computador
- c) Porque assim a cobra não cresce
- d) Porque os frames são aleatórios

<details><summary>Resposta</summary>

**b) Porque a velocidade do jogo passaria a depender dos FPS do computador** — Com um passo fixo (um acumulador de tempo real), as regras avançam ao mesmo ritmo em qualquer máquina, e o desenho corre ao ritmo que conseguir.

</details>

**2.** O que é a 'espiral da morte' num ciclo com passo fixo, e como se evita?

- a) Um bug do pygame; atualizando a versão
- b) Depois de um engasgo, correr todos os passos em atraso atrasa ainda mais o frame seguinte; evita-se com um máximo de passos por frame, descartando o resto
- c) A cobra a morder a própria cauda; com histerese
- d) O ecrã a cintilar; com flip()

<details><summary>Resposta</summary>

**b) Depois de um engasgo, correr todos os passos em atraso atrasa ainda mais o frame seguinte; evita-se com um máximo de passos por frame, descartando o resto** — Mais vale o jogo saltar um bocado do que nunca recuperar o atraso.

</details>

**3.** Porque é que o cobra.py (as regras) não importa o pygame?

- a) Por causa da licença do pygame
- b) Para as regras se testarem sem ecrã e se reutilizarem noutras interfaces (terminal, bot, servidor)
- c) Porque o pygame é lento
- d) Porque o Python não deixa importar o pygame em dois ficheiros

<details><summary>Resposta</summary>

**b) Para as regras se testarem sem ecrã e se reutilizarem noutras interfaces (terminal, bot, servidor)** — É a mesma separação das camadas do módulo 04: o núcleo não conhece a interface.

</details>

**4.** Que função do pygame mostra de uma vez, no ecrã, tudo o que foi desenhado no frame?

<details><summary>Resposta</summary>

**pygame.display.flip** — Desenha-se numa imagem escondida e o flip troca-a com a visível (double buffering), sem cintilação.

</details>

**5.** Como se tornam testáveis as partes aleatórias do jogo (onde aparece a comida)?

- a) Não se testam
- b) Com um gerador próprio com semente, random.Random(semente): a mesma semente dá sempre o mesmo jogo
- c) Repetindo o teste até passar
- d) Usando time.sleep

<details><summary>Resposta</summary>

**b) Com um gerador próprio com semente, random.Random(semente): a mesma semente dá sempre o mesmo jogo** — A mesma técnica serve para replays e para jogos em rede (lockstep).

</details>

<!-- quiz:end -->
