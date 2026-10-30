# Configuração do projeto Django (já feita: lê-a, mas não precisas de mexer).
# Gerada pelo "django-admin startproject" e adaptada. Ver docs/31-django.md, secção 3.
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# A chave que assina as sessões e os tokens CSRF. Como o JWT_SECRET do módulo 04: em produção vem
# de uma variável de ambiente; este valor por omissão é só para desenvolvimento.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "so-para-desenvolvimento-nunca-em-producao")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

INSTALLED_APPS = [
    "django.contrib.admin",          # o painel de administração em /admin/
    "django.contrib.auth",           # utilizadores, grupos, permissões, hashing de passwords
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",                # Django REST Framework: a API JSON
    "notas",                         # a nossa app
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "projeto.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "projeto.wsgi.application"
ASGI_APPLICATION = "projeto.asgi.application"

# SQLite: um ficheiro, zero instalação. Em produção seria o Postgres (ENGINE
# "django.db.backends.postgresql", com NAME, USER, PASSWORD e HOST vindos do ambiente).
# Nos testes, o pytest-django cria uma BD nova e vazia, que apaga no fim.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "pt-pt"
TIME_ZONE = "Europe/Lisbon"
USE_I18N = True
USE_TZ = True          # as datas são guardadas em UTC e convertidas para o fuso só ao mostrar

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # Por omissão, a API exige um utilizador autenticado. Cada view pode ser mais permissiva,
    # mas esquecer-se de proteger uma view nova deixa de ser possível (seguro por omissão).
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
