import pytest
from django.contrib import admin

pytestmark = pytest.mark.django_db


def test_os_modelos_estao_registados_no_admin():
    from notas.models import Etiqueta, Nota

    assert admin.site.is_registered(Nota), "falta registar a Nota"
    assert admin.site.is_registered(Etiqueta), "falta registar a Etiqueta"


def test_a_lista_de_notas_tem_colunas_filtros_e_pesquisa():
    from notas.models import Nota

    ma = admin.site._registry[Nota]
    assert list(ma.list_display) == ["titulo", "dono", "feita", "criada_em"]
    assert list(ma.list_filter) == ["feita", "etiquetas"]
    assert set(ma.search_fields) == {"titulo", "texto"}
    assert list(ma.list_editable) == ["feita"]


def test_o_admin_funciona_para_um_superutilizador(admin_client, django_user_model):
    from notas.models import Nota

    dono = django_user_model.objects.create_user("ana")
    Nota.objects.create(dono=dono, titulo="Comprar pão")
    Nota.objects.create(dono=dono, titulo="Relatório")
    r = admin_client.get("/admin/notas/nota/?q=pão")
    assert r.status_code == 200
    html = r.content.decode()
    assert "Comprar pão" in html and "Relatório" not in html, "a pesquisa devia filtrar pelo título"
