# P3 · O serializer: converte uma Nota em JSON (e JSON numa Nota), com validação.
from rest_framework import serializers  # noqa: F401

# Descomenta quando o P1 estiver feito:
# from .models import Etiqueta, Nota

# NotaSerializer (um ModelSerializer da Nota):
#   - campos: id, titulo, texto, feita, criada_em, etiquetas
#   - id e criada_em só de leitura; o dono NÃO aparece (vem de quem está autenticado)
#   - etiquetas: pelos NOMES, e não pelos ids (SlugRelatedField com slug_field="nome",
#     many=True, required=False, e queryset=Etiqueta.objects.all())
#   - validate_titulo: tira os espaços das pontas; se ficar vazio, ValidationError
