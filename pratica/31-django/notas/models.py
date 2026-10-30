# P1 · Os modelos: cada classe é uma tabela, cada atributo é uma coluna.
# Ver docs/31-django.md, secção "Prática".
from django.conf import settings
from django.db import models

# Etiqueta:
#   - nome: texto até 50 caracteres, ÚNICO
#   - __str__ devolve o nome
#
# Nota:
#   - dono: chave estrangeira para o utilizador (settings.AUTH_USER_MODEL); apagar o utilizador
#     apaga as suas notas; related_name="notas" (para escrever utilizador.notas.all())
#   - titulo: texto até 200 caracteres
#   - texto: texto longo, opcional (blank=True)
#   - feita: booleano, por omissão False
#   - criada_em: data e hora, preenchida automaticamente na criação
#   - etiquetas: muitas-para-muitas com Etiqueta, opcional (blank=True), related_name="notas"
#   - class Meta: ordenação por omissão das mais recentes para as mais antigas ("-criada_em")
#   - __str__ devolve o título
#
# Depois de escreveres os modelos, gera a migração (dentro de pratica/31-django/):
#   ../.venv/bin/python manage.py makemigrations notas
