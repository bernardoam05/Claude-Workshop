# Preparação partilhada pelos testes do módulo 60: um broker Mosquitto a sério, num contentor.
import shutil
import subprocess
import threading
import time
import uuid

import paho.mqtt.client as mqtt
import pytest

IMAGEM = "eclipse-mosquitto:2.0.22"


def esperar(condicao, segundos=5.0):
    """Repete a condição até ser verdadeira (o MQTT é assíncrono: as mensagens demoram um pouco)."""
    fim = time.monotonic() + segundos
    while time.monotonic() < fim:
        if condicao():
            return True
        time.sleep(0.05)
    return condicao()


@pytest.fixture(scope="session")
def broker():
    if shutil.which("docker") is None or subprocess.run(["docker", "info"], capture_output=True).returncode != 0:
        pytest.skip("estes testes precisam do Docker a correr")
    nome = f"mqtt-pratica-{uuid.uuid4().hex[:6]}"
    # O Mosquitto 2 só aceita ligações locais por omissão: este config abre a porta 1883 a todos,
    # sem autenticação. Só para testes! Em produção: utilizadores, ACLs e TLS (ver o módulo, §8).
    config = "listener 1883\nallow_anonymous true\n"
    subprocess.run(
        ["docker", "run", "-d", "--name", nome, "-p", "127.0.0.1::1883", IMAGEM,
         "sh", "-c", f"printf '{config}' > /tmp/m.conf && exec mosquitto -c /tmp/m.conf"],
        check=True, capture_output=True,
    )
    try:
        porta = int(subprocess.run(["docker", "port", nome, "1883"], capture_output=True, text=True, check=True)
                    .stdout.splitlines()[0].rsplit(":", 1)[1])
        assert esperar(lambda: _aceita_ligacoes(porta), 15), "o Mosquitto não arrancou"
        yield ("127.0.0.1", porta)
    finally:
        subprocess.run(["docker", "rm", "-f", nome], capture_output=True)


def _aceita_ligacoes(porta):
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    try:
        c.connect("127.0.0.1", porta, keepalive=5)
        c.disconnect()
        return True
    except OSError:
        return False


class Observador:
    """Um cliente MQTT de teste: subscreve um filtro e guarda tudo o que recebe."""

    def __init__(self, host, porta, filtro):
        self.mensagens = []          # (tópico, payload em texto, retido?)
        self._lock = threading.Lock()
        self._subscrito = threading.Event()
        self.cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.cliente.on_connect = lambda c, u, f, rc, p: c.subscribe(filtro, qos=1)
        self.cliente.on_subscribe = lambda *a: self._subscrito.set()
        self.cliente.on_message = self._recebeu
        self.cliente.connect(host, porta)
        self.cliente.loop_start()
        assert self._subscrito.wait(5), "o observador não conseguiu subscrever"

    def _recebeu(self, c, u, msg):
        with self._lock:
            self.mensagens.append((msg.topic, msg.payload.decode(), msg.retain))

    def em(self, topico):
        with self._lock:
            return [(p, r) for t, p, r in self.mensagens if t == topico]

    def publicar(self, topico, payload, retain=False):
        self.cliente.publish(topico, payload, qos=1, retain=retain).wait_for_publish(5)

    def fechar(self):
        self.cliente.disconnect()
        self.cliente.loop_stop()


@pytest.fixture
def observador(broker):
    abertos = []

    def criar(filtro):
        o = Observador(*broker, filtro)
        abertos.append(o)
        return o

    yield criar
    for o in abertos:
        o.fechar()
