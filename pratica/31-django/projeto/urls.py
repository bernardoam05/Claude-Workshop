# As rotas do projeto (já feito). Cada app tem o seu urls.py; aqui só se ligam.
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("notas.urls")),
]
