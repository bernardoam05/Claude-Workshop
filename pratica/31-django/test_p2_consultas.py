import pytest

from notas import consultas

pytestmark = pytest.mark.django_db


@pytest.fixture
def dados(django_user_model):
    from notas.models import Etiqueta, Nota

    ana = django_user_model.objects.create_user("ana")
    bruno = django_user_model.objects.create_user("bruno")
    casa, trabalho, vazia = (Etiqueta.objects.create(nome=n) for n in ["casa", "trabalho", "vazia"])
    n1 = Nota.objects.create(dono=ana, titulo="Comprar pão")
    n2 = Nota.objects.create(dono=ana, titulo="Pagar a luz", feita=True)
    n3 = Nota.objects.create(dono=ana, titulo="Relatório")
    Nota.objects.create(dono=bruno, titulo="Comprar leite")
    n1.etiquetas.add(casa)
    n2.etiquetas.add(casa)
    n3.etiquetas.add(trabalho, casa)
    return {"ana": ana, "bruno": bruno}


def titulos(qs):
    return [n.titulo for n in qs]


def test_pendentes_de(dados):
    assert titulos(consultas.pendentes_de(dados["ana"])) == ["Relatório", "Comprar pão"]


def test_pesquisar_sem_distinguir_maiusculas_e_so_do_proprio(dados):
    assert titulos(consultas.pesquisar(dados["ana"], "COMPRAR")) == ["Comprar pão"]
    assert titulos(consultas.pesquisar(dados["bruno"], "comprar")) == ["Comprar leite"]


def test_contar_por_etiqueta_numa_so_query(dados, django_assert_num_queries):
    with django_assert_num_queries(1):
        resultado = list(consultas.contar_por_etiqueta())
    assert resultado == [("casa", 3), ("trabalho", 1), ("vazia", 0)]


def test_marcar_todas_feitas_numa_so_query(dados, django_assert_num_queries):
    with django_assert_num_queries(1):
        alteradas = consultas.marcar_todas_feitas(dados["ana"])
    assert alteradas == 2
    assert titulos(consultas.pendentes_de(dados["ana"])) == []
    assert titulos(consultas.pendentes_de(dados["bruno"])) == ["Comprar leite"], "as do bruno não deviam mudar"


def test_com_etiquetas_evita_o_problema_n_mais_1(dados, django_assert_num_queries):
    # Sem prefetch_related: 1 query para as notas + 1 por cada nota para as etiquetas (N+1).
    with django_assert_num_queries(2):
        resultado = {n.titulo: sorted(e.nome for e in n.etiquetas.all()) for n in consultas.com_etiquetas(dados["ana"])}
    assert resultado == {"Comprar pão": ["casa"], "Pagar a luz": ["casa"], "Relatório": ["casa", "trabalho"]}
