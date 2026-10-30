# P3 · As views da API, com o Django REST Framework.
from rest_framework import viewsets  # noqa: F401
from rest_framework.decorators import action  # noqa: F401
from rest_framework.response import Response  # noqa: F401

# Descomenta quando tiveres o modelo (P1) e o serializer:
# from .models import Nota
# from .serializers import NotaSerializer

# NotaViewSet (um ModelViewSet): GET/POST /api/notas/ e GET/PUT/PATCH/DELETE /api/notas/<id>/
#   - serializer_class = NotaSerializer
#   - get_queryset: SÓ as notas de quem está autenticado (self.request.user). Assim, a nota de
#     outra pessoa dá 404 (lembras-te do IDOR, no módulo 26?)
#   - perform_create: grava com dono = self.request.user
#   - uma ação extra GET /api/notas/pendentes/ (@action com detail=False) que devolve só as
#     notas por fazer de quem está autenticado
