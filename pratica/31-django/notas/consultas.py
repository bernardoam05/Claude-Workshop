# P2 · Consultas com o ORM do Django (o equivalente às queries SQL do módulo 03).
from django.db.models import Count  # noqa: F401 (vais precisar dele)

# Descomenta quando o P1 estiver feito:
# from .models import Etiqueta, Nota


def pendentes_de(utilizador):
    """As notas do utilizador que ainda não estão feitas (um QuerySet, pela ordem por omissão)."""
    raise NotImplementedError("P2")


def pesquisar(utilizador, texto):
    """As notas do utilizador cujo título contém o texto, sem distinguir maiúsculas."""
    raise NotImplementedError("P2")


def contar_por_etiqueta():
    """Uma lista de (nome da etiqueta, número de notas), por nome. Inclui etiquetas com 0 notas.
    Ex.: [("casa", 2), ("trabalho", 0)]. Uma ÚNICA query (annotate + Count)."""
    raise NotImplementedError("P2")


def marcar_todas_feitas(utilizador):
    """Marca como feitas TODAS as notas pendentes do utilizador, numa ÚNICA query (update),
    e devolve quantas foram alteradas."""
    raise NotImplementedError("P2")


def com_etiquetas(utilizador):
    """As notas do utilizador, já com as etiquetas carregadas: percorrer as notas e as etiquetas
    de cada uma tem de custar só 2 queries, quantas notas houver (prefetch_related)."""
    raise NotImplementedError("P2")
