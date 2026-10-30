import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def ana(django_user_model):
    return django_user_model.objects.create_user("ana")


@pytest.fixture
def bruno(django_user_model):
    return django_user_model.objects.create_user("bruno")


def cliente(utilizador=None):
    c = APIClient()
    if utilizador:
        c.force_authenticate(utilizador)   # salta o login: estes testes são sobre a API, não sobre a autenticação
    return c


def test_sem_autenticacao_a_api_recusa():
    assert cliente().get("/api/notas/").status_code == 403


def test_criar_uma_nota_com_etiquetas_pelo_nome(ana):
    from notas.models import Etiqueta

    Etiqueta.objects.create(nome="casa")
    r = cliente(ana).post("/api/notas/", {"titulo": "  Comprar pão  ", "etiquetas": ["casa"]}, format="json")
    assert r.status_code == 201, r.json()
    corpo = r.json()
    assert corpo["titulo"] == "Comprar pão", "o validate_titulo devia tirar os espaços"
    assert corpo["feita"] is False and corpo["etiquetas"] == ["casa"]
    assert set(corpo) == {"id", "titulo", "texto", "feita", "criada_em", "etiquetas"}, "o dono não deve aparecer na API"


def test_o_dono_vem_de_quem_esta_autenticado_e_nao_do_corpo(ana, bruno):
    from notas.models import Nota

    r = cliente(ana).post("/api/notas/", {"titulo": "x", "dono": bruno.id}, format="json")
    assert r.status_code == 201
    assert Nota.objects.get(id=r.json()["id"]).dono == ana


def test_titulo_vazio_da_400_com_a_mensagem_no_campo(ana):
    r = cliente(ana).post("/api/notas/", {"titulo": "   "}, format="json")
    assert r.status_code == 400
    assert "titulo" in r.json()


def test_cada_um_so_ve_as_suas_e_a_dos_outros_da_404(ana, bruno):
    from notas.models import Nota

    Nota.objects.create(dono=ana, titulo="da ana")
    dele = Nota.objects.create(dono=bruno, titulo="do bruno")
    assert [n["titulo"] for n in cliente(ana).get("/api/notas/").json()] == ["da ana"]
    assert cliente(ana).get(f"/api/notas/{dele.id}/").status_code == 404
    assert cliente(ana).patch(f"/api/notas/{dele.id}/", {"feita": True}, format="json").status_code == 404
    assert cliente(ana).delete(f"/api/notas/{dele.id}/").status_code == 404


def test_patch_e_delete_nas_proprias(ana):
    from notas.models import Nota

    n = Nota.objects.create(dono=ana, titulo="x")
    r = cliente(ana).patch(f"/api/notas/{n.id}/", {"feita": True}, format="json")
    assert r.status_code == 200 and r.json()["feita"] is True
    assert cliente(ana).delete(f"/api/notas/{n.id}/").status_code == 204
    assert not Nota.objects.filter(id=n.id).exists()


def test_acao_pendentes(ana, bruno):
    from notas.models import Nota

    Nota.objects.create(dono=ana, titulo="por fazer")
    Nota.objects.create(dono=ana, titulo="feita", feita=True)
    Nota.objects.create(dono=bruno, titulo="do bruno")
    r = cliente(ana).get("/api/notas/pendentes/")
    assert r.status_code == 200
    assert [n["titulo"] for n in r.json()] == ["por fazer"]


def test_a_app_corre_num_servidor_asgi_a_serio_uvicorn():
    # Até aqui, os pedidos eram simulados pelo APIClient. Este arranca o uvicorn de verdade.
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        porta = s.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "projeto.asgi:application", "--port", str(porta)],
        cwd=Path(__file__).parent, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    try:
        codigo = None
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{porta}/api/notas/")
            except urllib.error.HTTPError as e:
                codigo = e.code
                break
            except OSError:
                time.sleep(0.2)
        assert codigo == 403, "o uvicorn devia servir a API (e recusar quem não está autenticado)"
    finally:
        proc.terminate()
        proc.wait(timeout=10)
