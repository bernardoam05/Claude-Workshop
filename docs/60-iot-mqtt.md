# 60 · IoT com MQTT

**Objetivo:** perceber como se ligam milhares de dispositivos pequenos (sensores, contadores, máquinas) a um backend, o que os torna diferentes de um browser, e saber usar o MQTT, o protocolo de mensagens que domina a Internet das Coisas: tópicos e wildcards, QoS, mensagens retidas, *last will*, e o lado do servidor que recebe e trata a telemetria.

**Ficheiros para ler:** os da prática, em `pratica/60-iot-mqtt/`. A parte de Python está explicada no módulo 31, secção 2.

**Pré-requisitos:** módulo 06 (RabbitMQ: produtores, consumidores e brokers) e módulo 17 (Kafka), para comparar.

---

## 1. O que é a IoT

A **Internet das Coisas** (IoT, *Internet of Things*) são objetos físicos com sensores, um pequeno processador e uma ligação de rede, que enviam dados e recebem ordens. Exemplos que estão à tua volta:

- os **contadores inteligentes** de eletricidade e água, que enviam o consumo de 15 em 15 minutos e dispensam a leitura em casa;
- sensores de temperatura em **camiões frigoríficos** e armazéns de vacinas, com alarme se a cadeia de frio falhar;
- **agricultura**: sensores de humidade do solo que decidem quando regar;
- **indústria** (a "Indústria 4.0"): máquinas que avisam antes de avariar (manutenção preditiva);
- trotinetes e bicicletas partilhadas, que enviam a posição GPS e recebem "desbloqueia".

A arquitetura repete-se quase sempre:

```
 dispositivos          gateway / edge            broker              backend
┌──────────┐         ┌──────────────┐       ┌───────────┐      ┌──────────────────────┐
│ sensor   │─BLE────▶│ junta, filtra│──MQTT▶│           │─────▶│ valida, guarda,      │
│ sensor   │─Zigbee─▶│ e envia      │       │ Mosquitto │      │ alerta, mostra       │
└──────────┘         └──────────────┘       │ EMQX      │      │ (séries temporais,   │
┌──────────┐                                │ AWS IoT   │◀─────│  dashboards, regras) │
│ contador │────────────── MQTT ───────────▶│           │      └──────────────────────┘
└──────────┘     (diretamente, por 4G/Wi-Fi)└───────────┘   comandos ▲ de volta
```

## 2. Porque é que um dispositivo não é um browser

Tudo o que aprendeste sobre APIs HTTP assume um cliente com energia, CPU e uma ligação estável. Um sensor não tem nada disso:

| Restrição | Consequência no desenho |
|---|---|
| **Energia:** uma bateria tem de durar anos | o rádio fica desligado quase sempre; o dispositivo acorda, envia e volta a dormir |
| **Hardware:** um microcontrolador com algumas centenas de KB de RAM | protocolos com cabeçalhos pequenos; nada de JSON gigante, às vezes nem JSON |
| **Rede:** 4G fraco, dentro de um armazém, a mexer-se | a ligação cai sempre; quem envia tem de saber reenviar, e quem recebe tem de aguentar duplicados |
| **Escala:** milhões de dispositivos | o backend tem de aguentar picos (todos os contadores a enviar à hora certa) |
| **Acesso físico:** qualquer pessoa pode abrir o aparelho | cada dispositivo tem a **sua** credencial, revogável; nunca uma password partilhada |
| **Atualizações:** ninguém vai lá com um cabo | atualizações remotas (OTA, *over the air*), que não podem deixar o aparelho morto se falharem a meio |

## 3. Os protocolos

Há duas camadas que se confundem com frequência: **como o sinal chega** (rádio) e **que mensagens se trocam** (aplicação).

| Camada | Protocolo | Para quê |
|---|---|---|
| Rádio, curto alcance | **BLE** (Bluetooth Low Energy), **Zigbee**, **Thread** | dentro de casa ou de uma fábrica, até um gateway |
| Rádio, longo alcance e baixo consumo | **LoRaWAN**, **NB-IoT**, **LTE-M** | quilómetros, com baterias de anos (contadores, agricultura) |
| Rede comum | Wi-Fi, Ethernet, 4G/5G | dispositivos com energia |
| Aplicação | **MQTT** | publicar/subscrever através de um broker: o mais usado |
| Aplicação | **CoAP** | um "HTTP muito leve" sobre UDP, para os aparelhos mais pequenos |
| Aplicação | **HTTP** | quando o dispositivo tem recursos e só envia de vez em quando |

## 4. MQTT: publicar e subscrever

O **MQTT** nasceu em 1999 para monitorizar oleodutos por satélite: ligações caras e instáveis, aparelhos fracos. Hoje é um padrão aberto (OASIS) e a escolha por omissão em IoT.

Tal como no RabbitMQ (módulo 06), há um **broker** no meio, e os clientes nunca falam diretamente uns com os outros:

```
sensor da sala  ──publica──▶  casa/sala/temperatura  ──▶ broker ──▶  quem subscreveu casa/+/temperatura
```

Comparado com o que já conheces:

| | MQTT | RabbitMQ (AMQP) | Kafka |
|---|---|---|---|
| Pensado para | muitos clientes pequenos e instáveis | serviços de backend | grandes volumes, histórico |
| Encaminhamento | por tópico, com wildcards | exchanges, filas e bindings | tópicos e partições |
| Guarda mensagens? | só a última "retida" de cada tópico (e as pendentes de sessões) | até serem consumidas | durante dias, com histórico |
| Cabeçalho mínimo | 2 bytes | dezenas | dezenas |

É comum usar os três juntos: os dispositivos falam MQTT com o broker, e uma ponte passa as mensagens para Kafka ou RabbitMQ, onde os serviços de backend as consomem com as ferramentas que já conhecem.

Brokers que vais encontrar: **Mosquitto** (o mais simples, o desta prática), **EMQX** e **HiveMQ** (para milhões de ligações, em cluster), e os geridos das clouds, como o **AWS IoT Core** e o **Azure IoT Hub**.

## 5. Tópicos e wildcards

Um tópico é um caminho de níveis separados por `/`. Não é preciso criá-lo: existe quando alguém publica nele.

```
casa/sala/temperatura
casa/sala/humidade
casa/cozinha/temperatura
fabrica/linha-3/prensa-7/vibracao
```

Quem subscreve pode usar dois wildcards:

| Filtro | Apanha | Não apanha |
|---|---|---|
| `casa/+/temperatura` | `casa/sala/temperatura`, `casa/cozinha/temperatura` | `casa/temperatura`, `casa/r/c/temperatura` |
| `casa/#` | `casa`, `casa/sala`, `casa/sala/luz/estado` | `casota/sala` |
| `#` | tudo, exceto os tópicos `$SYS/...` do próprio broker | |

Regras: o `+` vale exatamente **um** nível; o `#` vale **zero ou mais** níveis e só pode aparecer **no fim**; os dois têm de ocupar o nível inteiro (`casa/sala+` não é válido). Os wildcards só existem nas **subscrições**: não se publica em `casa/+`.

Um bom desenho de tópicos vai do geral para o particular (`<local>/<dispositivo>/<medida>`), usa identificadores estáveis, e separa os sentidos: `.../telemetria` (do dispositivo para o servidor) e `.../comandos` (do servidor para o dispositivo). Assim, as permissões (§8) são simples: cada dispositivo só pode publicar e subscrever debaixo do seu próprio prefixo.

## 6. QoS: quanto custa a garantia de entrega

Cada publicação e cada subscrição escolhe um nível de **qualidade de serviço**:

| QoS | Garantia | Como | Usar para |
|---|---|---|---|
| **0** | no máximo uma vez | envia e esquece | leituras frequentes em que perder uma não importa |
| **1** | **pelo menos uma vez** | quem recebe confirma (PUBACK); sem confirmação, reenvia | o normal: alarmes, comandos, eventos |
| **2** | exatamente uma vez | um aperto de mão em quatro passos | raro: quando um duplicado é caro (faturação) |

O QoS 1 é o mais usado, e tem uma consequência que já conheces do módulo 06: **pode haver duplicados**. Se a confirmação se perder, o dispositivo reenvia uma mensagem que o broker já tinha recebido. O consumidor tem de ser **idempotente**: ver a mesma leitura duas vezes não pode contar a mesma coisa duas vezes. Uma forma é cada leitura levar um identificador ou o *timestamp* da medição.

O QoS de entrega é o **mínimo** entre o da publicação e o da subscrição: se publicas com QoS 1 e subscreves com QoS 0, recebes com QoS 0.

## 7. Retidas, last will, sessões e keepalive

Quatro funcionalidades que existem por causa das ligações instáveis:

**Mensagem retida** (`retain=True`): o broker guarda a **última** mensagem retida de cada tópico e entrega-a a quem subscrever **depois**. Serve para estados: um dashboard que abre agora quer saber já se a porta está aberta, sem esperar pela próxima mudança. Uma mensagem retida vazia apaga a que estava guardada.

**Last Will and Testament** (LWT, o "testamento"): ao ligar-se, o cliente entrega ao broker uma mensagem para publicar **se ele desaparecer sem se despedir** (a rede caiu, a bateria acabou). É a forma de o sistema saber que um dispositivo está offline:

```python
cliente.will_set("casa/sala/estado", "offline", qos=1, retain=True)   # ANTES do connect
cliente.connect(host, 1883)
cliente.publish("casa/sala/estado", "online", qos=1, retain=True)     # depois de ligar
```

Com o `online` e o testamento `offline` no mesmo tópico, ambos retidos, quem subscrever `casa/+/estado` sabe sempre o estado de cada dispositivo. Atenção: uma saída **limpa** (`disconnect()`) **não** dispara o testamento. Quem se despede publica o seu próprio `offline`.

**Keepalive:** o cliente compromete-se a falar com o broker pelo menos a cada N segundos (com um PING, se não tiver mais nada). Se o broker não ouvir nada durante 1,5 × N, dá a ligação por morta e publica o testamento. É como o broker deteta um dispositivo que ficou sem rede sem fechar a ligação TCP.

**Sessões persistentes** (`clean_session=False` no MQTT 3.1.1, ou `clean_start=False` com `session_expiry_interval` no MQTT 5): o broker guarda as subscrições e as mensagens com QoS ≥ 1 enquanto o cliente está desligado, e entrega-as quando ele volta. É o que permite a um aparelho que acorda de hora a hora receber os comandos enviados entretanto.

## 8. Segurança

O teu broker de testes aceita qualquer pessoa (`allow_anonymous true`). Num sistema real, isto é o equivalente a deixar a porta da rua aberta, e já houve milhares de brokers expostos na Internet assim: câmaras e fechaduras controladas por desconhecidos.

- **TLS** sempre: a porta 8883 em vez da 1883. Sem isso, as passwords e os dados viajam em claro.
- **Uma identidade por dispositivo.** O mais forte são certificados de cliente (mTLS), gravados na fábrica ou no provisionamento: é assim que funcionam o AWS IoT Core e o Azure IoT Hub. Uma password partilhada por todos os aparelhos é uma password que um atacante extrai de um aparelho e usa em todos.
- **ACLs por tópico:** o dispositivo `sala` só publica em `casa/sala/#` e só lê `casa/sala/comandos`. É o controlo de acesso do módulo 26, aplicado a tópicos.
- **Revogar** um dispositivo roubado, sem afetar os outros.
- **Desconfiar do conteúdo:** o servidor valida tudo o que chega (o `descodificar` do P2). Um aparelho comprometido, ou só avariado, envia lixo, e o backend não pode cair por causa disso.

## 9. O lado do servidor: tratar a telemetria

Receber a mensagem é a parte fácil. O trabalho está no que vem a seguir:

1. **Validar** (§8): formato, tipos e limites físicos. Um sensor de temperatura que diz 999 °C não está num forno, está avariado.
2. **Suavizar o ruído:** sensores baratos oscilam. Uma **média móvel** das últimas N leituras dá um valor estável.
3. **Decidir com histerese:** um termóstato que liga abaixo de 20 °C e desliga acima de 20 °C, com a temperatura a oscilar entre 19,9 e 20,1, liga e desliga a cada leitura e estraga o equipamento. Com uma margem (liga abaixo de 19,5, desliga acima de 20,5), o estado só muda quando a mudança é real.
4. **Guardar em séries temporais:** bases de dados otimizadas para "valor + instante", como **InfluxDB**, **TimescaleDB** (uma extensão do Postgres) ou o próprio **Prometheus** (módulo 19), com retenção (ex.: 1 minuto de resolução durante 30 dias, depois só médias horárias).
5. **Regras e alertas:** "se a câmara frigorífica passar dos 8 °C durante 10 minutos, avisa o turno". É o `for:` das regras de alerta do módulo 19.
6. **Gémeo digital** (*device shadow*): uma cópia no servidor do estado desejado e do estado reportado de cada aparelho. O backend escreve "quero o aquecimento ligado"; quando o aparelho acordar, recebe a diferença e cumpre-a.

## 10. Edge computing

Enviar cada leitura para a cloud custa rede, energia e dinheiro, e não funciona quando a ligação cai. A **computação na borda** (*edge*) faz parte do trabalho num gateway local (um Raspberry Pi, um PC industrial): agrega leituras, envia só médias ou exceções, e continua a tomar decisões (desligar uma máquina em sobreaquecimento) mesmo sem Internet. A cloud fica com o histórico e a visão de conjunto.

---

## Prática: escreve tu

Quatro peças de um sistema de aquecimento ligado: as regras dos tópicos, o tratamento de leituras, o firmware de um aquecedor (em Python, como num Raspberry Pi) e a central que ouve todos. As duas primeiras são lógica pura; as duas últimas falam MQTT com um broker **Mosquitto a sério**, que os testes arrancam num contentor Docker.

**Ficheiros:** `pratica/60-iot-mqtt/` (`topicos.py`, `sensores.py`, `dispositivo.py`, `central.py`)

**Verificar:** `npm run verificar 60` (dentro de `pratica/`). Só um exercício: `npm run verificar 60 p1`, `... 60 p2`, `... 60 p3` ou `... 60 p4`. O P3 e o P4 precisam do Docker a correr.

**O cliente MQTT** é o `paho-mqtt` 2.x (instalado em `pratica/.venv`). O essencial da API:

```python
import paho.mqtt.client as mqtt

c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="meu-id")
c.on_connect = lambda cliente, userdata, flags, reason_code, properties: ...
c.on_message = lambda cliente, userdata, msg: ...   # msg.topic, msg.payload (bytes), msg.retain
c.will_set(topico, payload, qos=1, retain=True)    # antes do connect
c.connect(host, porta)
c.loop_start()                                     # uma thread trata da rede; os callbacks correm nela
c.subscribe("casa/+/temperatura", qos=1)           # ou uma lista de (filtro, qos)
c.publish(topico, payload, qos=1, retain=False).wait_for_publish(5)
c.disconnect(); c.loop_stop()
```

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Tópicos e wildcards (≈25 min)

**Ficheiro:** `topicos.py`

Escreve as regras da secção 5: validar um filtro, e decidir se um tópico é apanhado por ele. É o que o broker faz para cada mensagem, para cada subscrição. Os testes cobrem os casos que costumam falhar: `casa/#` apanha `casa`, um nível vazio também é um nível, e os tópicos `$SYS` ficam de fora dos wildcards.

**Sintaxe que vais praticar:** `str.split`, `enumerate`, `len`, comparação de listas por índice, `raise ValueError(...)`, f-strings com `!r`.

<details>
<summary>Pista</summary>

Divide o filtro e o tópico em listas de níveis com `split("/")` e percorre o filtro nível a nível. Há três saídas antecipadas: um `#` (corresponde, seja o que for o resto), um tópico que acabou antes do filtro (não corresponde), e um nível diferente que não é `+`. Se chegares ao fim do filtro sem sair, falta uma última pergunta: o tópico também acabou?
</details>

<details>
<summary>Solução de referência</summary>

```python
def validar_filtro(filtro: str) -> None:
    if not filtro:
        raise ValueError("o filtro não pode ser vazio")
    niveis = filtro.split("/")
    for i, nivel in enumerate(niveis):
        if "#" in nivel and (nivel != "#" or i != len(niveis) - 1):
            raise ValueError(f"'#' tem de ocupar sozinho o último nível: {filtro!r}")
        if "+" in nivel and nivel != "+":
            raise ValueError(f"'+' tem de ocupar o nível inteiro: {filtro!r}")


def corresponde(filtro: str, topico: str) -> bool:
    # Os tópicos de sistema ($SYS/...) só são apanhados por filtros que também comecem por $.
    if topico.startswith("$") and filtro[:1] in ("+", "#"):
        return False
    f, t = filtro.split("/"), topico.split("/")
    for i, nivel in enumerate(f):
        if nivel == "#":
            return True                     # apanha o resto, incluindo "nada" (casa/# apanha casa)
        if i >= len(t):
            return False                    # o filtro tem mais níveis do que o tópico
        if nivel != "+" and nivel != t[i]:
            return False
    return len(f) == len(t)                 # sem #, têm de ter o mesmo número de níveis
```
</details>

### P2 · Tratar leituras de sensores (≈30 min)

**Ficheiro:** `sensores.py`

Três peças da secção 9: uma média móvel, um termóstato com histerese e a validação de uma mensagem que pode vir estragada. Os testes atiram-lhe lixo de propósito: bytes que nem são UTF-8, JSON que não é um objeto, temperaturas em texto, `true` no lugar de um número, e valores fisicamente impossíveis.

**Sintaxe que vais praticar:** classes com `__init__` e estado, `collections.deque(maxlen=...)`, `json.loads`, `bytes.decode`, `isinstance` com tuplas de tipos, comparações encadeadas (`-40 <= t <= 85`), `raise ... from e`.

<details>
<summary>Pista</summary>

Um `deque(maxlen=n)` deita fora o elemento mais antigo sozinho quando lhe acrescentas um a mais: é a janela da média móvel sem contas. Na validação, cuidado com uma armadilha do Python: `isinstance(True, int)` é `True`, porque `bool` é uma subclasse de `int`. Exclui o `bool` primeiro.
</details>

<details>
<summary>Solução de referência</summary>

```python
import json
from collections import deque


class MediaMovel:
    def __init__(self, n: int):
        if n < 1:
            raise ValueError("a janela tem de ter pelo menos 1 leitura")
        self._janela = deque(maxlen=n)    # um deque com maxlen deita fora a mais antiga sozinho

    def adicionar(self, valor: float) -> float:
        self._janela.append(valor)
        return sum(self._janela) / len(self._janela)


class Termostato:
    def __init__(self, alvo: float, margem: float):
        self.alvo = alvo
        self.margem = margem
        self.ligado = False

    def atualizar(self, temperatura: float) -> bool:
        if temperatura < self.alvo - self.margem:
            self.ligado = True
        elif temperatura > self.alvo + self.margem:
            self.ligado = False
        # entre os dois limites: não mexe (histerese)
        return self.ligado


def descodificar(payload: bytes) -> dict:
    try:
        dados = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ValueError(f"mensagem ilegível: {e}") from e
    if not isinstance(dados, dict):
        raise ValueError("a mensagem tem de ser um objeto JSON")

    sensor = dados.get("sensor")
    if not isinstance(sensor, str) or not sensor:
        raise ValueError("falta o sensor")

    temperatura = dados.get("temperatura")
    # bool é uma subclasse de int em Python: sem esta exclusão, true passaria como 1.
    if isinstance(temperatura, bool) or not isinstance(temperatura, (int, float)):
        raise ValueError("a temperatura tem de ser um número")
    if not -40 <= temperatura <= 85:
        raise ValueError(f"temperatura fora do alcance do sensor: {temperatura}")

    return {"sensor": sensor, "temperatura": float(temperatura)}
```
</details>

### P3 · O firmware de um aquecedor (≈40 min)

**Ficheiro:** `dispositivo.py`

Um dispositivo que anuncia que está online (retido), publica a temperatura com QoS 1, obedece aos comandos que lhe são dirigidos, e deixa um testamento ao broker. O último teste corta a ligação TCP sem aviso, como uma falha de rede, e confirma que é o **broker** quem anuncia o `offline`.

**Sintaxe que vais praticar:** `paho-mqtt` (`Client`, `will_set`, `connect`, `loop_start`, `subscribe`, `publish`, `wait_for_publish`), callbacks como métodos, `threading.Event` para esperar pelo `on_connect`.

<details>
<summary>Pista</summary>

O `connect()` não espera que a ligação seja aceite: quem te avisa é o `on_connect`, que corre noutra thread (a do `loop_start`). Um `threading.Event` resolve a espera: o `on_connect` faz `.set()`, e o `ligar` faz `.wait(5)`. Subscreve e publica o `online` **dentro** do `on_connect`: se a rede falhar e o paho voltar a ligar sozinho, os dois são repostos.
</details>

<details>
<summary>Solução de referência</summary>

```python
import json
import threading

import paho.mqtt.client as mqtt


class Dispositivo:
    def __init__(self, ident: str):
        self.ident = ident
        self.aquecimento = False
        self._base = f"casa/{ident}"
        self._ligado = threading.Event()
        self.cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"aquecedor-{ident}")
        self.cliente.on_connect = self._ao_ligar
        self.cliente.on_message = self._ao_receber

    def ligar(self, host: str, porta: int) -> None:
        # O testamento fica guardado no BROKER durante a ligação: ele publica-o se nós desaparecermos.
        self.cliente.will_set(f"{self._base}/estado", "offline", qos=1, retain=True)
        self.cliente.connect(host, porta, keepalive=10)
        self.cliente.loop_start()                  # uma thread do paho trata da rede a partir daqui
        if not self._ligado.wait(5):
            raise TimeoutError("o broker não aceitou a ligação")

    def _ao_ligar(self, cliente, userdata, flags, reason_code, properties):
        # No on_connect, e não logo a seguir ao connect(): assim, se a ligação cair e o paho
        # voltar a ligar sozinho, a subscrição e o "online" são repostos.
        cliente.subscribe(f"{self._base}/comandos", qos=1)
        cliente.publish(f"{self._base}/estado", "online", qos=1, retain=True)
        self._ligado.set()

    def _ao_receber(self, cliente, userdata, msg):
        comando = msg.payload.decode(errors="replace")
        if comando == "ligar":
            self.aquecimento = True
        elif comando == "desligar":
            self.aquecimento = False

    def publicar_temperatura(self, valor: float) -> None:
        payload = json.dumps({"sensor": self.ident, "temperatura": valor})
        self.cliente.publish(f"{self._base}/temperatura", payload, qos=1).wait_for_publish(5)

    def desligar(self) -> None:
        # Uma saída limpa (DISCONNECT) NÃO dispara o testamento: por isso o "offline" é publicado à mão.
        self.cliente.publish(f"{self._base}/estado", "offline", qos=1, retain=True).wait_for_publish(5)
        self.cliente.disconnect()
        self.cliente.loop_stop()
```
</details>

### P4 · A central (≈30 min)

**Ficheiro:** `central.py`

O lado do servidor: subscreve os tópicos de **todos** os dispositivos com wildcards, guarda a última temperatura de cada um e quem está online, e calcula um resumo. Reutiliza o `descodificar` do P2: uma mensagem inválida é contada e ignorada, nunca derruba a central. Um dos testes publica estados retidos **antes** de a central ligar, e confirma que ela os recebe.

**Sintaxe que vais praticar:** subscrever uma lista de `(filtro, qos)`, desempacotar o tópico (`_, ident, tipo = msg.topic.split("/")`), `set` e `dict` como estado, `threading.Lock` com `with`, `round`.

<details>
<summary>Pista</summary>

Os callbacks do paho correm na thread da rede, e o `resumo()` é chamado pela thread principal: sem um `Lock`, uma pode ler o `dict` enquanto a outra o altera. Põe todo o acesso aos dados dentro de `with self._lock:`. Para saber quando a subscrição está ativa, há o callback `on_subscribe`.
</details>

<details>
<summary>Solução de referência</summary>

```python
import threading

import paho.mqtt.client as mqtt

from sensores import descodificar


class Central:
    def __init__(self):
        self.ultimas = {}
        self.online = set()
        self.rejeitadas = 0
        self._lock = threading.Lock()
        self._subscrito = threading.Event()
        self.cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.cliente.on_connect = lambda c, u, f, rc, p: c.subscribe(
            [("casa/+/temperatura", 1), ("casa/+/estado", 1)]
        )
        self.cliente.on_subscribe = lambda *args: self._subscrito.set()
        self.cliente.on_message = self._ao_receber

    def ligar(self, host: str, porta: int) -> None:
        self.cliente.connect(host, porta)
        self.cliente.loop_start()
        if not self._subscrito.wait(5):
            raise TimeoutError("não consegui subscrever")

    def _ao_receber(self, cliente, userdata, msg):
        _, ident, tipo = msg.topic.split("/")
        with self._lock:
            if tipo == "estado":
                if msg.payload == b"online":
                    self.online.add(ident)
                else:
                    self.online.discard(ident)
                return
            try:
                leitura = descodificar(msg.payload)
            except ValueError:
                self.rejeitadas += 1        # lixo de um sensor nunca derruba a central
                return
            self.ultimas[ident] = leitura["temperatura"]

    def resumo(self) -> dict:
        with self._lock:
            valores = list(self.ultimas.values())
            return {
                "online": sorted(self.online),
                "media": round(sum(valores) / len(valores), 1) if valores else None,
            }

    def desligar(self) -> None:
        self.cliente.disconnect()
        self.cliente.loop_stop()
```
</details>

## Experiências

Um broker para mexeres à mão, e os clientes de linha de comandos que vêm na mesma imagem:

```bash
docker run -d --name mqtt -p 127.0.0.1:1883:1883 eclipse-mosquitto:2.0.22 \
  sh -c 'printf "listener 1883\nallow_anonymous true\n" > /tmp/m.conf && exec mosquitto -c /tmp/m.conf'
docker exec -it mqtt mosquitto_sub -t '#' -v          # num terminal: mostra TUDO o que passa
docker exec mqtt mosquitto_pub -t casa/sala/temperatura -m '{"sensor":"sala","temperatura":21}'
```

No fim: `docker rm -f mqtt`. Para uma interface gráfica, o [MQTT Explorer](https://mqtt-explorer.com/) mostra a árvore de tópicos em tempo real.

1. **Retida vs normal:** publica `-m online -r` em `casa/x/estado` (o `-r` é retain) e `-m 20` em `casa/x/temperatura` (sem `-r`). Só depois abre um `mosquitto_sub -t 'casa/#' -v`. Qual das duas recebes?
2. **O testamento a funcionar:** num terminal, `docker exec -it mqtt mosquitto_sub -t 'casa/+/estado' -v`. Noutro, liga um cliente com testamento: `docker exec -it mqtt mosquitto_sub -t x --will-topic casa/y/estado --will-payload offline -k 5`. Mata só o segundo, sem lhe dar hipótese de se despedir: `docker exec mqtt pkill -9 -f will-topic`. O `offline` aparece no primeiro terminal. Repara que, com Ctrl+C (uma saída limpa), não aparece.
3. **O que se vê sem TLS:** com o `tcpdump` (ou o Wireshark) a ouvir a porta 1883, publica uma mensagem com utilizador e password (`-u ana -P segredo`). Ambos aparecem em claro na captura. É a razão da porta 8883.
4. **O broker por dentro:** `mosquitto_sub -t '$SYS/#' -v` mostra as estatísticas do broker (clientes ligados, mensagens por segundo). Repara que o `#` sozinho não as mostrava.

## Perguntas de pensamento crítico

1. Os contadores de eletricidade de um país inteiro enviam o consumo à hora certa, todos ao mesmo tempo. Que problema isto cria no backend, e como o resolverias do lado dos dispositivos?
2. Um colega quer usar QoS 2 em todas as leituras de temperatura, "para não perder nenhuma". Concordas?
3. Porque é que o backend tem de validar as mensagens, se fomos nós que escrevemos o firmware dos dispositivos?

<details>
<summary>Respostas</summary>

1. Um pico enorme e periódico (o *thundering herd*): durante uns segundos, milhões de ligações e mensagens, e o resto da hora quase nada. O backend teria de ser dimensionado para o pico. Do lado dos dispositivos, acrescenta-se uma espera aleatória (*jitter*) antes de enviar (ex.: entre 0 e 15 minutos), o que espalha a carga pela hora inteira. Do lado do servidor, um broker em cluster e uma fila (Kafka) a absorver o pico ajudam, mas espalhar na origem é o mais barato.
2. Não. O QoS 2 custa quatro mensagens por leitura em vez de duas, o que pesa na bateria e na rede de milhares de aparelhos. Para temperaturas, perder uma leitura entre centenas não muda nada, e um duplicado também não (a última leitura substitui a anterior). O QoS 1 com um consumidor idempotente, ou mesmo o QoS 0 para leituras muito frequentes, é a escolha certa. O QoS 2 fica para mensagens em que um duplicado custa dinheiro.
3. Porque o firmware não é a única coisa que pode falar com o broker: um aparelho pode ser comprometido (tem acesso físico, §2), um sensor pode avariar e enviar valores absurdos, uma versão antiga do firmware pode enviar um formato diferente, e uma credencial roubada permite a qualquer um publicar. A regra do módulo 26 aplica-se igual: tudo o que vem de fora é input não confiável.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 60`.

**1.** O filtro casa/+/temperatura apanha qual destes tópicos?

- a) casa/temperatura
- b) casa/sala/temperatura
- c) casa/r/c/temperatura
- d) casa/sala/temperatura/max

<details><summary>Resposta</summary>

**b) casa/sala/temperatura** — O + substitui exatamente um nível. Para zero ou mais níveis, no fim, usa-se o #.

</details>

**2.** Com QoS 1, o que tem o consumidor de aguentar?

- a) Perder mensagens
- b) Receber a mesma mensagem mais do que uma vez (pelo menos uma vez), por isso tem de ser idempotente
- c) Mensagens fora do formato JSON
- d) Ligações cifradas

<details><summary>Resposta</summary>

**b) Receber a mesma mensagem mais do que uma vez (pelo menos uma vez), por isso tem de ser idempotente** — Se a confirmação (PUBACK) se perder, quem publica reenvia. É a mesma lição do RabbitMQ no módulo 06.

</details>

**3.** Para que serve o Last Will and Testament?

- a) Para cifrar as mensagens
- b) Para o broker publicar uma mensagem (ex.: 'offline') se o cliente desaparecer sem se despedir
- c) Para guardar a última leitura de cada sensor
- d) Para reenviar mensagens perdidas

<details><summary>Resposta</summary>

**b) Para o broker publicar uma mensagem (ex.: 'offline') se o cliente desaparecer sem se despedir** — Configura-se antes de ligar. Uma saída limpa (DISCONNECT) não o dispara: quem se despede publica o seu próprio 'offline'.

</details>

**4.** Que flag faz o broker guardar a última mensagem de um tópico e entregá-la a quem subscrever depois (em inglês)?

<details><summary>Resposta</summary>

**retain** — Serve para estados (online/offline, aberto/fechado): um dashboard que abre agora sabe logo o estado atual.

</details>

**5.** Porque é que um termóstato precisa de histerese?

- a) Para poupar bateria no sensor
- b) Para não ligar e desligar a cada leitura quando a temperatura oscila à volta do alvo
- c) Para converter Celsius em Fahrenheit
- d) Para filtrar mensagens inválidas

<details><summary>Resposta</summary>

**b) Para não ligar e desligar a cada leitura quando a temperatura oscila à volta do alvo** — Com uma margem (liga abaixo de alvo-margem, desliga acima de alvo+margem), o estado só muda quando a mudança é real.

</details>

<!-- quiz:end -->
