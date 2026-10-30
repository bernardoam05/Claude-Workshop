# P4 · O painel de administração: registar os modelos dá-te um CRUD completo em /admin/.
from django.contrib import admin  # noqa: F401

# Descomenta quando o P1 estiver feito:
# from .models import Etiqueta, Nota

# Regista a Etiqueta (simples) e a Nota com um ModelAdmin que:
#   - mostra as colunas titulo, dono, feita e criada_em na lista (list_display)
#   - tem filtros laterais por feita e por etiquetas (list_filter)
#   - pesquisa no titulo e no texto (search_fields)
#   - deixa marcar "feita" diretamente na lista (list_editable)
