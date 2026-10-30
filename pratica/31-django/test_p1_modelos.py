import pytest
from django.apps import apps
from django.core.management import call_command
from django.db import IntegrityError, models

pytestmark = pytest.mark.django_db


def modelo(nome):
    try:
        return apps.get_model("notas", nome)
    except LookupError:
        pytest.fail(f"falta o modelo {nome} em notas/models.py")


def campo(m, nome):
    try:
        return m._meta.get_field(nome)
    except Exception:
        pytest.fail(f"o modelo {m.__name__} não tem o campo {nome}")


def test_etiqueta_tem_nome_unico_ate_50():
    Etiqueta = modelo("Etiqueta")
    nome = campo(Etiqueta, "nome")
    assert isinstance(nome, models.CharField) and nome.max_length == 50 and nome.unique


def test_campos_da_nota():
    Nota = modelo("Nota")
    assert isinstance(campo(Nota, "titulo"), models.CharField) and campo(Nota, "titulo").max_length == 200
    assert isinstance(campo(Nota, "texto"), models.TextField) and campo(Nota, "texto").blank
    feita = campo(Nota, "feita")
    assert isinstance(feita, models.BooleanField) and feita.default is False
    criada = campo(Nota, "criada_em")
    assert isinstance(criada, models.DateTimeField) and criada.auto_now_add, "criada_em: auto_now_add=True"
    etiquetas = campo(Nota, "etiquetas")
    assert isinstance(etiquetas, models.ManyToManyField) and etiquetas.blank


def test_dono_e_uma_chave_estrangeira_com_cascade(django_user_model):
    Nota = modelo("Nota")
    dono = campo(Nota, "dono")
    assert isinstance(dono, models.ForeignKey) and dono.related_model is django_user_model
    ana = django_user_model.objects.create_user("ana")
    Nota.objects.create(dono=ana, titulo="a")
    assert ana.notas.count() == 1, 'related_name="notas" permite escrever ana.notas'
    ana.delete()
    assert Nota.objects.count() == 0, "apagar o utilizador devia apagar as notas (on_delete=CASCADE)"


def test_valores_por_omissao_e_str(django_user_model):
    Nota, Etiqueta = modelo("Nota"), modelo("Etiqueta")
    n = Nota.objects.create(dono=django_user_model.objects.create_user("ana"), titulo="Comprar pão")
    assert n.feita is False and n.criada_em is not None and n.texto == ""
    assert str(n) == "Comprar pão"
    assert str(Etiqueta.objects.create(nome="casa")) == "casa"


def test_nomes_de_etiqueta_repetidos_sao_recusados_pela_bd():
    Etiqueta = modelo("Etiqueta")
    Etiqueta.objects.create(nome="casa")
    with pytest.raises(IntegrityError):
        Etiqueta.objects.create(nome="casa")


def test_ordenacao_por_omissao_das_mais_recentes(django_user_model):
    Nota = modelo("Nota")
    ana = django_user_model.objects.create_user("ana")
    for t in ["primeira", "segunda", "terceira"]:
        Nota.objects.create(dono=ana, titulo=t)
    assert [n.titulo for n in Nota.objects.all()] == ["terceira", "segunda", "primeira"]


def test_a_migracao_existe_e_esta_em_dia():
    # Igual a correr "manage.py makemigrations --check": falha se os modelos mudaram e ninguém
    # gerou a migração (o erro clássico de quem esquece de a fazer commit).
    try:
        call_command("makemigrations", "notas", "--check", "--dry-run", verbosity=0)
    except SystemExit:
        pytest.fail("os modelos têm alterações sem migração: corre ../.venv/bin/python manage.py makemigrations notas")
    from django.db.migrations.loader import MigrationLoader

    assert any(app == "notas" for app, _ in MigrationLoader(None).disk_migrations), "ainda não há nenhuma migração em notas/migrations/"
