# Preparação partilhada pelos testes do módulo 34 (o pytest carrega este ficheiro sozinho).
#
# Arranca três contentores Alpine com Python (as "máquinas" que o Ansible vai configurar), instala a
# coleção community.docker na primeira vez, e dá aos testes uma função para correr playbooks.
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

AQUI = Path(__file__).parent
BIN = Path(__file__).resolve().parents[1] / ".venv" / "bin"
HOSTS = ["ans-web1", "ans-web2", "ans-db1"]
IMAGEM = "python:3.12-alpine"


def docker(*args, check=True):
    return subprocess.run(["docker", *args], capture_output=True, text=True, check=check)


def sh(host, comando):
    """Corre um comando dentro de um dos contentores e devolve o stdout (ou None se falhar)."""
    r = docker("exec", host, "sh", "-c", comando, check=False)
    return r.stdout if r.returncode == 0 else None


@pytest.fixture(scope="session", autouse=True)
def maquinas():
    if shutil.which("docker") is None or docker("info", check=False).returncode != 0:
        pytest.skip("estes testes precisam do Docker a correr")
    if not (AQUI / ".colecoes" / "ansible_collections" / "community" / "docker").exists():
        subprocess.run(
            [BIN / "ansible-galaxy", "collection", "install", "-r", "requirements.yml", "-p", ".colecoes"],
            cwd=AQUI, check=True, capture_output=True,
        )
    # Máquinas novas em cada execução: assim, a primeira corrida de cada playbook parte do zero.
    for h in HOSTS:
        docker("rm", "-f", h, check=False)
        docker("run", "-d", "--name", h, "--hostname", h, IMAGEM, "sleep", "infinity")
    yield
    for h in HOSTS:
        docker("rm", "-f", h, check=False)


class Resultado:
    def __init__(self, proc):
        self.codigo = proc.returncode
        self.saida = proc.stdout + proc.stderr

    def alteracoes(self):
        """{host: número de tarefas "changed"}, lido do PLAY RECAP no fim da saída."""
        return {h: int(n) for h, n in re.findall(r"^(\S+)\s*:\s*ok=\d+\s+changed=(\d+)", self.saida, re.M)}


@pytest.fixture
def playbook():
    def correr(ficheiro, *extra):
        texto = (AQUI / ficheiro).read_text()
        linhas = [l for l in texto.splitlines() if l.strip() and not l.strip().startswith("#")]
        if not linhas:
            pytest.fail(f"ainda não começaste o {ficheiro}")
        env = {**os.environ, "ANSIBLE_FORCE_COLOR": "0", "ANSIBLE_NOCOLOR": "1", "PATH": f"{BIN}:{os.environ['PATH']}"}
        proc = subprocess.run(
            [BIN / "ansible-playbook", ficheiro, *extra], cwd=AQUI, env=env, capture_output=True, text=True
        )
        return Resultado(proc)

    return correr
