# 31 · Python, Django e Django REST Framework

**Objetivo:** construir uma API em Python com o Django, a framework "com pilhas incluídas": modelos e ORM, migrações geradas sozinhas, um painel de administração de graça, e uma API REST com o Django REST Framework. Saber onde o Django se encaixa ao lado do Flask e do FastAPI, e o que são o WSGI, o ASGI e o uvicorn.

**Ficheiros para ler:** `pratica/31-django/projeto/settings.py` e `projeto/urls.py` (já feitos), e compara com o `src/api` em Node que conheces desde o módulo 01.

**Pré-requisitos:** módulos 01 (HTTP), 03 (SQL e migrações), 04 (camadas) e 26 (IDOR). Python básico: se nunca escreveste Python, a secção 2 dá-te o essencial.

---

## 1. Porquê Python, e porquê Django

O Python é a linguagem mais usada em dados, machine learning, automação e ciência, e uma das mais usadas em backend. Em Portugal, aparece muito em vagas de backend, em startups e em empresas de dados.

No backend em Python há três frameworks que vais encontrar:

| | **Django** | **Flask** | **FastAPI** |
|---|---|---|---|
| Filosofia | "pilhas incluídas": traz quase tudo | micro: traz o mínimo, tu escolhes o resto | moderna, centrada em APIs e tipos |
| ORM e migrações | incluídos | à parte (SQLAlchemy + Alembic) | à parte (SQLAlchemy, SQLModel) |
| Painel de admin | incluído | não | não |
| Autenticação, sessões, CSRF | incluídos | extensões | à parte |
| API REST | com o Django REST Framework (DRF) | à mão ou extensões | o centro da framework, com OpenAPI automático |
| Async | suportado, mas o ORM ainda é sobretudo síncrono | limitado | nativo |
| Quando escolher | produtos com BD relacional, backoffice, equipas que querem convenções | serviços pequenos, protótipos, total liberdade | APIs e microserviços, sobretudo com muito I/O |

Comparado com o que já conheces: o Express (módulo 01) é parecido com o Flask, uma base pequena onde juntas peças. O Spring Boot (módulo 18) e o ASP.NET Core (módulo 21) são mais parecidos com o Django: muitas decisões já tomadas por ti, e convenções que toda a gente da equipa segue.

## 2. Python em 5 minutos (o que vais usar aqui)

```python
# Variáveis e tipos: sem let/const; a indentação (4 espaços) define os blocos, não chavetas
nome = "Ana"
idade: int = 30                      # anotação de tipo: opcional, não é verificada ao correr
notas = ["a", "b"]                   # lista (como um array)
pessoa = {"nome": "Ana", "idade": 30}   # dicionário (como um objeto JS)
par = ("casa", 3)                    # tupla: uma lista que não muda

if idade >= 18 and nome != "":       # and/or/not, e não &&/||/!
    print(f"{nome} é adulta")        # f-string: o equivalente aos template literals `${}`

for n in notas:
    print(n)

maiusculas = [n.upper() for n in notas]          # list comprehension: o .map() do Python
pares = {k: v for k, v in pessoa.items()}        # dict comprehension

def saudar(nome, saudacao="Olá"):                # argumentos com valor por omissão
    return f"{saudacao}, {nome}"

saudar("Ana", saudacao="Bom dia")                # argumentos por nome

class Nota:
    def __init__(self, titulo):                  # o construtor; self é o this
        self.titulo = titulo

    def __str__(self):                           # o "toString"
        return self.titulo

try:
    int("abc")
except ValueError as e:                          # o catch
    print("não é um número:", e)
```

Duas diferenças que te vão morder: `None` em vez de `null`/`undefined`, e `True`/`False` com maiúscula.

**Ambientes virtuais.** Em Node, cada projeto tem o seu `node_modules`. Em Python, o equivalente é um **ambiente virtual**: uma pasta com um Python e os pacotes só deste projeto.

```bash
python3 -m venv .venv                    # criar (a prática já o faz por ti, em pratica/.venv)
source .venv/bin/activate                # ativar: "python" e "pip" passam a ser os do .venv
pip install -r requirements.txt          # o "npm install"; o requirements.txt é o package.json
```

Ferramentas mais recentes, como o **uv** e o **Poetry**, juntam o venv, o lock file e a instalação num só comando, e vais vê-las em projetos novos.

## 3. A anatomia de um projeto Django

```
31-django/
├── manage.py            # a linha de comandos do projeto: runserver, migrate, shell, ...
├── projeto/             # o PROJETO: configuração global
│   ├── settings.py      # BD, apps instaladas, middleware, segurança
│   ├── urls.py          # as rotas de topo (que incluem as de cada app)
│   ├── asgi.py          # o ponto de entrada para servidores ASGI (uvicorn)
│   └── wsgi.py          # o ponto de entrada para servidores WSGI (gunicorn)
└── notas/               # uma APP: uma parte do domínio, com tudo o que lhe pertence
    ├── models.py        # as tabelas
    ├── migrations/      # as migrações, GERADAS a partir dos modelos
    ├── admin.py         # o registo no painel de administração
    ├── serializers.py   # (DRF) a conversão de/para JSON
    ├── views.py         # o que responde a cada pedido
    └── urls.py          # as rotas da app
```

Um **projeto** tem várias **apps**. Cada app é um pedaço do domínio (notas, faturação, utilizadores) que pode, em teoria, ser reutilizado noutro projeto. É a mesma ideia dos *bounded contexts* (módulo 13): um projeto Django grande costuma ter dezenas de apps.

Os comandos que vais usar sempre:

```bash
python manage.py runserver               # servidor de desenvolvimento em http://127.0.0.1:8000
python manage.py makemigrations          # gera as migrações a partir das mudanças nos modelos
python manage.py migrate                 # aplica as migrações à BD
python manage.py createsuperuser         # cria um administrador
python manage.py shell                   # uma consola Python com o projeto carregado
```

O pedido percorre o mesmo caminho que no Express, com nomes diferentes:

```
pedido → middleware (sessões, CSRF, autenticação) → urls.py → view → (models → BD) → resposta
```

O que o Django chama **view** é o que no Express é o *handler* de uma rota, e o que noutras frameworks se chama *controller*. Atenção à confusão de nomes: no Django, o "V" do MVC chama-se *template*.

## 4. Modelos e o ORM

```python
from django.conf import settings
from django.db import models


class Nota(models.Model):
    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notas")
    titulo = models.CharField(max_length=200)
    feita = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criada_em"]
```

Cada classe é uma tabela (`notas_nota`, com o nome da app à frente), cada atributo é uma coluna, e o `id` é acrescentado sozinho. O **ORM** (*Object-Relational Mapper*) traduz Python para SQL:

```python
Nota.objects.filter(dono=ana, feita=False)            # SELECT ... WHERE dono_id = %s AND NOT feita
Nota.objects.filter(titulo__icontains="pão")           # ... WHERE titulo LIKE '%pão%' (sem maiúsculas)
Nota.objects.get(id=7)                                 # uma só; DoesNotExist se não houver
Nota.objects.create(dono=ana, titulo="Comprar pão")   # INSERT
Nota.objects.filter(dono=ana).update(feita=True)       # UPDATE ... WHERE (uma só query)
Nota.objects.filter(feita=True).delete()               # DELETE
ana.notas.count()                                      # graças ao related_name
```

Os **QuerySets são preguiçosos**: `Nota.objects.filter(...)` não vai à BD. A query só corre quando precisas dos dados (num `for`, num `list()`, num `len()`). Por isso podes encadear filtros à vontade. Para veres o SQL de um QuerySet: `print(qs.query)`.

E, como no módulo 26: o ORM **parametriza tudo** por ti. Um `filter(titulo__icontains=texto)` com `texto = "' OR 1=1 --"` procura literalmente esse texto. A injeção de SQL volta se usares `raw()` ou `extra()` com strings montadas à mão.

### O problema N+1

O erro de desempenho mais comum com qualquer ORM:

```python
for nota in Nota.objects.filter(dono=ana):        # 1 query para as notas
    print([e.nome for e in nota.etiquetas.all()])  # + 1 query POR NOTA para as etiquetas
```

Com 100 notas, são 101 queries. Em desenvolvimento, com 3 notas, nem se nota; em produção, a página demora segundos. O Django tem duas soluções:

- **`select_related("dono")`**: para chaves estrangeiras (um para um, muitos para um). Faz um `JOIN` na mesma query.
- **`prefetch_related("etiquetas")`**: para muitos-para-muitos e relações inversas. Faz **uma** query extra para todas as notas de uma vez (`WHERE nota_id IN (...)`), e junta os resultados em Python.

Com qualquer uma delas, o número de queries deixa de depender do número de notas. Os testes do P2 contam as queries para garantirem isto.

## 5. Migrações: geradas, não escritas

No módulo 03 escreveste as migrações SQL à mão. No Django, escreves os **modelos**, e ele calcula a diferença:

```bash
python manage.py makemigrations notas   # compara os modelos com as migrações existentes e gera a próxima
python manage.py sqlmigrate notas 0001  # mostra o SQL que essa migração vai correr
python manage.py migrate                # aplica as que faltam (e regista-as na tabela django_migrations)
```

O `sqlmigrate` da migração do P1 mostra (em SQLite):

```sql
CREATE TABLE "notas_nota" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "titulo" varchar(200) NOT NULL,
  "texto" text NOT NULL, "feita" bool NOT NULL, "criada_em" datetime NOT NULL,
  "dono_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "notas_nota_dono_id_22473b59" ON "notas_nota" ("dono_id");
```

Compara com o que escreveste no módulo 03:

- A tabela `django_migrations` é a `schema_migrations` do `migrate.js`: a mesma ideia de registar o que já correu.
- O Django **cria sozinho o índice na chave estrangeira** (`dono_id`), que no Postgres puro tiveste de pedir à mão.
- O `ON DELETE CASCADE` **não** aparece no SQL: o Django faz a cascata em Python, apagando primeiro as linhas dependentes. Funciona se apagares pelo Django; se apagares diretamente na BD com `psql`, a BD não sabe que devia apagar as notas.
- As regras são as mesmas do módulo 03: **as migrações vão para o Git**, e nunca se edita uma que já foi aplicada noutro ambiente.

## 6. O painel de administração

Três linhas em `admin.py` dão-te uma interface completa para ver, pesquisar, criar e editar dados:

```python
@admin.register(Nota)
class NotaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "dono", "feita", "criada_em"]
    search_fields = ["titulo", "texto"]
```

É uma das grandes razões para escolher o Django: o backoffice para a equipa de apoio ao cliente ou de operações vem de graça, com as permissões do sistema de utilizadores do Django. Não é uma interface para os teus clientes, é para a tua equipa.

## 7. Django REST Framework (DRF)

O Django nasceu para gerar páginas HTML. Para APIs JSON, a extensão padrão é o **Django REST Framework**, com três peças:

**O serializer** converte um modelo em JSON e valida o JSON que chega (o papel do Zod no módulo 04):

```python
class NotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nota
        fields = ["id", "titulo", "feita", "criada_em"]
        read_only_fields = ["id", "criada_em"]

    def validate_titulo(self, valor):              # validate_<campo>: chamado sozinho pelo DRF
        if not valor.strip():
            raise serializers.ValidationError("O título não pode estar vazio.")
        return valor.strip()
```

Repara no que **não** está em `fields`: o `dono`. Um campo que não está na lista não aparece na resposta nem é aceite no pedido. É a proteção contra *mass assignment* do módulo 26, feita por declaração.

**O ViewSet** junta as cinco operações CRUD numa classe:

```python
class NotaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaSerializer

    def get_queryset(self):                        # a base de TODAS as operações
        return Nota.objects.filter(dono=self.request.user)

    def perform_create(self, serializer):         # o dono vem de quem está autenticado
        serializer.save(dono=self.request.user)
```

Como o `get_queryset` filtra pelo utilizador, a nota de outra pessoa simplesmente não existe para quem pede: o detalhe, o PATCH e o DELETE dão 404 sem mais código. É o mesmo princípio do `WHERE id = $1 AND user_id = $2` do `taskRepository.js`, e o melhor sítio para a autorização: um só.

**O router** gera as rotas:

```python
router = DefaultRouter()
router.register("notas", NotaViewSet, basename="nota")
# GET/POST /notas/   GET/PUT/PATCH/DELETE /notas/<id>/   (+ as @action que acrescentares)
```

As **permissões** vêm de `REST_FRAMEWORK` no `settings.py` (este projeto exige autenticação em tudo, por omissão) ou de `permission_classes` em cada view. Para autenticação de uma SPA ou de uma app móvel, usa-se normalmente JWT (o pacote `djangorestframework-simplejwt`) ou o OIDC com o Keycloak do módulo 15.

## 8. WSGI, ASGI, gunicorn e uvicorn

O `runserver` é só para desenvolvimento: um servidor simples, de um processo. Em produção, quem recebe os pedidos HTTP é um **servidor de aplicações**, que fala com o Django por uma interface padrão:

| Interface | Modelo | Servidores | Para quê |
|---|---|---|---|
| **WSGI** (o padrão antigo, de 2003) | síncrono: um pedido ocupa um *worker* do início ao fim | **gunicorn**, uWSGI | a maior parte das apps Django e Flask |
| **ASGI** (o sucessor assíncrono) | assíncrono: um *worker* atende muitos pedidos enquanto espera por I/O | **uvicorn**, Daphne, Hypercorn | WebSockets, streaming, muitas ligações lentas; obrigatório no FastAPI |

```bash
# ASGI, com o uvicorn (o que os testes do P3 arrancam)
uvicorn projeto.asgi:application --host 0.0.0.0 --port 8000 --workers 4

# WSGI, com o gunicorn
gunicorn projeto.wsgi:application --workers 4
```

Num deploy típico, há um Nginx à frente (módulo 10) que serve os ficheiros estáticos e encaminha o resto para o gunicorn ou o uvicorn, e o número de *workers* acompanha o número de núcleos. Com Docker, o `CMD` da imagem é a linha do uvicorn, e o `python manage.py migrate` corre antes, num passo de deploy (como o `migrate.js` da API em Node).

Porque é que isto importa: o Python tem o **GIL** (um bloqueio global que impede duas *threads* de correr código Python ao mesmo tempo). Por isso, em Python, escala-se com **processos** (`--workers`), e o ASGI ajuda quando o tempo se passa à espera da rede ou da BD. É o mesmo raciocínio do *event loop* do Node, com outras ferramentas.

## 9. Testes no Django

O `pytest` com o plugin `pytest-django` é o padrão em projetos novos:

```python
import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db                         # este teste pode usar a BD (uma BD de teste, limpa)
def test_cria_uma_nota(django_user_model):
    ana = django_user_model.objects.create_user("ana")
    cliente = APIClient()
    cliente.force_authenticate(ana)            # salta o login
    r = cliente.post("/api/notas/", {"titulo": "x"}, format="json")
    assert r.status_code == 201
```

Cada teste corre dentro de uma transação que é desfeita no fim, por isso começa sempre com a BD vazia. O fixture `django_assert_num_queries` conta as queries de um bloco: a forma de apanhares um N+1 num teste, antes de chegar a produção.

## Em resumo

- O **Django** traz quase tudo incluído (ORM, migrações, administração, autenticação); o **DRF** acrescenta as APIs REST.
- Um projeto divide-se em *apps*, cada uma com modelos, vistas e URLs; as definições vivem no `settings.py`.
- Os **modelos** são classes Python que o ORM traduz para tabelas; as consultas encadeiam-se e só correm quando são precisas (cuidado com o N+1: `select_related` e `prefetch_related`).
- As **migrações são geradas** a partir dos modelos (`makemigrations`) e revistas antes de as aplicar.
- O **painel de administração** dá um *back-office* com pouco código.
- No DRF, os *serializers* validam e convertem dados, os *viewsets* juntam as operações CRUD e os *routers* criam as rotas.
- Em produção, a app corre num servidor ASGI (uvicorn) ou WSGI (gunicorn), não no servidor de desenvolvimento.

---

## Prática: escreve tu

Uma API de notas completa em Django: modelos e migração, consultas com o ORM, uma API REST com o DRF (servida a sério pelo uvicorn no último teste), e o painel de administração. O projeto e a configuração já estão feitos; tu escreves a app `notas`.

**Ficheiros:** `pratica/31-django/notas/` (`models.py`, `consultas.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`), e a migração que vais gerar em `notas/migrations/`.

**Verificar:** `npm run verificar 31` (dentro de `pratica/`). Só um exercício: `npm run verificar 31 p1`, `... 31 p2`, `... 31 p3` ou `... 31 p4`. Não precisa de Docker: a BD é SQLite.

**Primeira vez:** o `verificar` cria o ambiente Python em `pratica/.venv`. Para usares o Django à mão, dentro de `pratica/31-django/`:

```bash
../.venv/bin/python manage.py makemigrations notas   # depois de escreveres os modelos
../.venv/bin/python manage.py migrate                # cria o db.sqlite3 (não vai para o Git)
../.venv/bin/python manage.py createsuperuser        # para entrares no /admin/
../.venv/bin/python -m uvicorn projeto.asgi:application --reload   # http://127.0.0.1:8000/admin/
```

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Modelos e migração (≈30 min)

**Ficheiro:** `notas/models.py` (e a migração gerada)

Dois modelos, `Etiqueta` e `Nota`, com uma chave estrangeira para o utilizador e uma relação muitos-para-muitos. As regras estão no comentário do ficheiro. O último teste confirma que geraste a migração e que ela está em dia com os modelos.

**Sintaxe que vais praticar:** `class X(models.Model)`, `CharField(max_length=...)`, `TextField(blank=True)`, `BooleanField(default=False)`, `DateTimeField(auto_now_add=True)`, `ForeignKey(..., on_delete=models.CASCADE, related_name=...)`, `ManyToManyField`, `class Meta: ordering`, `def __str__(self)`, e o comando `makemigrations`.

<details>
<summary>Pista</summary>

A `Etiqueta` tem de estar definida **antes** da `Nota` no ficheiro (ou referida por texto: `"Etiqueta"`). Se mudares um modelo depois de gerares a migração, o último teste falha: gera outra (`makemigrations` cria a `0002`) ou, como ainda ninguém a aplicou noutro sítio, apaga a `0001` e gera-a de novo.
</details>

<details>
<summary>Solução de referência</summary>

```python
from django.conf import settings
from django.db import models


class Etiqueta(models.Model):
    nome = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nome


class Nota(models.Model):
    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notas")
    titulo = models.CharField(max_length=200)
    texto = models.TextField(blank=True)
    feita = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)
    etiquetas = models.ManyToManyField(Etiqueta, blank=True, related_name="notas")

    class Meta:
        ordering = ["-criada_em"]

    def __str__(self):
        return self.titulo
```
</details>

### P2 · Consultas com o ORM (≈30 min)

**Ficheiro:** `notas/consultas.py`

Cinco funções, cada uma com a sua query. Duas delas têm de fazer o trabalho numa **única** query, e a última tem de evitar o problema N+1. Os testes contam as queries com o `django_assert_num_queries`.

**Sintaxe que vais praticar:** `filter`, lookups com dois underscores (`titulo__icontains`), `annotate(total=Count("notas"))`, `order_by`, `values_list`, `update`, `prefetch_related`.

<details>
<summary>Pista</summary>

O `Count("notas")` funciona a partir da `Etiqueta` por causa do `related_name="notas"` que puseste na relação muitos-para-muitos. Para devolver pares `(nome, total)`, o `values_list("nome", "total")` dá-te tuplas em vez de objetos. Um `update()` sobre um QuerySet é **um** `UPDATE` na BD; percorrer as notas com um `for` e fazer `save()` em cada uma seria uma query por nota.
</details>

<details>
<summary>Solução de referência</summary>

```python
from django.db.models import Count

from .models import Etiqueta, Nota


def pendentes_de(utilizador):
    return Nota.objects.filter(dono=utilizador, feita=False)


def pesquisar(utilizador, texto):
    # titulo__icontains → WHERE titulo LIKE '%texto%' sem distinguir maiúsculas (e parametrizado)
    return Nota.objects.filter(dono=utilizador, titulo__icontains=texto)


def contar_por_etiqueta():
    # annotate + Count → um LEFT JOIN com GROUP BY: as etiquetas sem notas aparecem com 0
    return (
        Etiqueta.objects.annotate(total=Count("notas"))
        .order_by("nome")
        .values_list("nome", "total")
    )


def marcar_todas_feitas(utilizador):
    # update() é um único UPDATE ... WHERE na BD; não carrega as notas para a memória
    return Nota.objects.filter(dono=utilizador, feita=False).update(feita=True)


def com_etiquetas(utilizador):
    # 1 query para as notas + 1 para TODAS as etiquetas delas (WHERE nota_id IN (...))
    return Nota.objects.filter(dono=utilizador).prefetch_related("etiquetas")
```

O `contar_por_etiqueta` gera este SQL (vê-o com `print(contar_por_etiqueta().query)` no `manage.py shell`), que é o mesmo `LEFT JOIN` com `GROUP BY` do P2b do módulo 03:

```sql
SELECT "notas_etiqueta"."nome", COUNT("notas_nota_etiquetas"."nota_id") AS "total"
FROM "notas_etiqueta" LEFT OUTER JOIN "notas_nota_etiquetas" ON (...)
GROUP BY "notas_etiqueta"."id", 1 ORDER BY 1 ASC
```
</details>

### P3 · A API com o DRF (≈40 min)

**Ficheiros:** `notas/serializers.py`, `notas/views.py` e `notas/urls.py`

Um serializer com etiquetas pelo nome e validação do título, um ViewSet em que cada pessoa só vê as suas notas, uma ação extra `/api/notas/pendentes/`, e o router. O último teste arranca o **uvicorn** a sério e faz-lhe um pedido HTTP.

**Sintaxe que vais praticar:** `serializers.ModelSerializer` com `class Meta`, `SlugRelatedField`, `validate_<campo>`, `viewsets.ModelViewSet`, `get_queryset`, `perform_create`, `@action(detail=False)`, `DefaultRouter`.

<details>
<summary>Pista</summary>

Escreve o `get_queryset` primeiro: depois disso, o 404 para as notas dos outros vem de graça em todas as rotas. Dentro da `@action`, reutiliza o `self.get_queryset()` (assim a ação herda a mesma regra de autorização) e o `self.get_serializer(..., many=True)`.
</details>

<details>
<summary>Solução de referência</summary>

`notas/serializers.py`:

```python
from rest_framework import serializers

from .models import Etiqueta, Nota


class NotaSerializer(serializers.ModelSerializer):
    # As etiquetas aparecem e são recebidas pelo nome ("casa"), e não pelo id.
    etiquetas = serializers.SlugRelatedField(
        slug_field="nome", many=True, required=False, queryset=Etiqueta.objects.all()
    )

    class Meta:
        model = Nota
        fields = ["id", "titulo", "texto", "feita", "criada_em", "etiquetas"]
        read_only_fields = ["id", "criada_em"]

    # validate_<campo> é chamado sozinho pelo DRF para esse campo.
    def validate_titulo(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("O título não pode estar vazio.")
        return valor
```

`notas/views.py`:

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Nota
from .serializers import NotaSerializer


class NotaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaSerializer

    # Todas as rotas (lista, detalhe, PATCH, DELETE) partem daqui: a nota de outra pessoa nem
    # existe para quem pede, por isso dá 404. É a autorização num sítio só.
    def get_queryset(self):
        return Nota.objects.filter(dono=self.request.user).prefetch_related("etiquetas")

    def perform_create(self, serializer):
        serializer.save(dono=self.request.user)

    @action(detail=False)
    def pendentes(self, request):
        notas = self.get_queryset().filter(feita=False)
        return Response(self.get_serializer(notas, many=True).data)
```

`notas/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from .views import NotaViewSet

router = DefaultRouter()
router.register("notas", NotaViewSet, basename="nota")

urlpatterns = router.urls
```

Repara no `prefetch_related` dentro do `get_queryset`: o serializer lê as etiquetas de cada nota, e sem ele a lista seria um N+1.
</details>

### P4 · O painel de administração (≈10 min)

**Ficheiro:** `notas/admin.py`

Regista os dois modelos, com colunas, filtros, pesquisa e edição na lista. O último teste entra no `/admin/` como superutilizador e faz uma pesquisa.

**Sintaxe que vais praticar:** `admin.site.register`, o decorador `@admin.register`, `admin.ModelAdmin` com `list_display`, `list_filter`, `search_fields` e `list_editable`.

<details>
<summary>Solução de referência</summary>

```python
from django.contrib import admin

from .models import Etiqueta, Nota

admin.site.register(Etiqueta)


@admin.register(Nota)
class NotaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "dono", "feita", "criada_em"]
    list_filter = ["feita", "etiquetas"]
    search_fields = ["titulo", "texto"]
    list_editable = ["feita"]
```

Depois de passar, cria um superutilizador e abre o `/admin/` no browser (os comandos estão na introdução da prática). Tens um backoffice completo, com pesquisa, filtros e histórico de alterações, e escreveste dez linhas.
</details>

## Experiências

Dentro de `pratica/31-django/`, depois de os testes passarem e de correres o `migrate`.

1. **Vê o SQL do ORM:** no `../.venv/bin/python manage.py shell`, corre `from notas.models import Nota; print(Nota.objects.filter(titulo__icontains="x").query)`. Experimenta outros lookups: `criada_em__year=2026`, `etiquetas__nome="casa"` (repara no `JOIN`).
2. **Provoca um N+1:** no `get_queryset` do P3, tira o `prefetch_related`. Os testes da API continuam a passar, porque o resultado é igual. Escreve um teste com o `django_assert_num_queries` para a listagem de 5 notas e vê o número subir.
3. **Uma migração nova:** acrescenta um campo `prioridade = models.IntegerField(default=0)` à `Nota`, corre `makemigrations` e lê a `0002` gerada e o seu `sqlmigrate`. Repara como o `default` resolve o problema das linhas que já existem (módulo 03). Desfaz depois, apagando o campo e a `0002`.
4. **A API navegável:** com o servidor a correr e com sessão iniciada no `/admin/`, abre `http://127.0.0.1:8000/api/notas/` no browser. O DRF mostra uma página HTML onde podes fazer pedidos à tua API sem Postman.

## Perguntas de pensamento crítico

1. Uma startup vai construir um produto com uma base de dados relacional, um backoffice para a equipa de apoio e uma API para uma app móvel. Django, Flask ou FastAPI? E se fosse um serviço que só recebe eventos e chama três APIs externas lentas?
2. Porque é que o `get_queryset` filtrado pelo utilizador é um sítio melhor para a autorização do que um `if nota.dono != request.user` dentro de cada método?
3. O ORM do Django esconde o SQL. Isso é bom ou mau para quem está a aprender? O que ganhaste por teres escrito SQL à mão no módulo 03?

<details>
<summary>Respostas</summary>

1. Para o produto, o Django: o ORM, as migrações, a autenticação e o admin (que **é** o backoffice) vêm feitos, e o DRF trata da API. Com Flask ou FastAPI, terias de escolher e ligar essas peças tu. Para o serviço de eventos com chamadas lentas, o FastAPI (ou outra solução assíncrona) encaixa melhor: não precisa de admin nem de muito ORM, e o modelo assíncrono atende muitos pedidos enquanto espera pelas APIs externas.
2. Porque fica num sítio só, e todas as operações (lista, detalhe, alteração, remoção e ações extra) partem dele. Com um `if` em cada método, basta esquecê-lo numa rota nova para abrir um IDOR. Além disso, a nota de outra pessoa nem chega a ser carregada, e a resposta é um 404 que não revela que ela existe.
3. As duas coisas. Ganhas velocidade e segurança (parametrização, migrações geradas), mas perdes a noção do que custa cada linha: um `for` inocente pode fazer cem queries. Como já sabes SQL, consegues ler o `print(qs.query)`, reconhecer um N+1, e saber quando escrever uma query à mão vale a pena. Quem só conhece o ORM não sabe porque é que a página está lenta.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 31`.

**1.** Num projeto Django, o que faz o 'python manage.py makemigrations'?

- a) Aplica as migrações à base de dados
- b) Compara os modelos com as migrações existentes e gera um ficheiro de migração novo com as diferenças
- c) Apaga a base de dados e cria-a de novo
- d) Gera os modelos a partir das tabelas

<details><summary>Resposta</summary>

**b) Compara os modelos com as migrações existentes e gera um ficheiro de migração novo com as diferenças** — As migrações são geradas, revistas e vão para o Git. Quem as aplica é o 'migrate'.

</details>

**2.** Uma lista de 100 notas faz 101 queries à BD. Como se chama o problema e como se resolve no Django?

- a) Deadlock; com transações
- b) N+1; com select_related (chaves estrangeiras) ou prefetch_related (muitos-para-muitos)
- c) Injeção de SQL; com parâmetros
- d) Cache miss; com Redis

<details><summary>Resposta</summary>

**b) N+1; com select_related (chaves estrangeiras) ou prefetch_related (muitos-para-muitos)** — Uma query para a lista e uma por item para a relação. O prefetch_related faz uma só query extra para todos os itens.

</details>

**3.** No NotaViewSet, porque é que o get_queryset filtra por dono=self.request.user?

- a) Para a lista vir ordenada
- b) Porque todas as operações (lista, detalhe, PATCH, DELETE) partem dele: a nota de outra pessoa dá 404 sem mais código
- c) Porque o DRF obriga
- d) Para usar menos memória

<details><summary>Resposta</summary>

**b) Porque todas as operações (lista, detalhe, PATCH, DELETE) partem dele: a nota de outra pessoa dá 404 sem mais código** — É a autorização num sítio só, a defesa contra o IDOR do módulo 26.

</details>

**4.** Que servidor ASGI usaste para servir o Django no P3 (o mesmo que o FastAPI usa)?

<details><summary>Resposta</summary>

**uvicorn** — ASGI é a interface assíncrona; o gunicorn é o servidor WSGI clássico. Em produção, com vários --workers, por causa do GIL.

</details>

**5.** Qual destas é uma vantagem do Django sobre o Flask para um produto com base de dados e backoffice?

- a) É mais pequeno e não impõe nada
- b) Traz ORM, migrações, autenticação e um painel de administração prontos a usar
- c) É o único que suporta Python 3
- d) Não precisa de servidor de aplicações

<details><summary>Resposta</summary>

**b) Traz ORM, migrações, autenticação e um painel de administração prontos a usar** — O Flask é micro: escolhes e juntas as peças. O Django é 'pilhas incluídas': as decisões já estão tomadas e as convenções são partilhadas.

</details>

<!-- quiz:end -->
