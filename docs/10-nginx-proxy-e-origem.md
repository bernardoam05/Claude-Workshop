# 10 · Nginx, reverse proxy e origem

**Objetivo:** perceber porque o browser, a API e os ficheiros estáticos aparecem **como uma só origem**, o que é um reverse proxy, e o que é CORS (e porque o evitamos em vez de o configurar).

**Ficheiros para ler primeiro:** `src/web/nginx.conf`, `src/web/vite.config.js`, `src/web/src/api.js`.

---

## 1. Origem (origin)

Uma **origem** é o trio `protocolo + domínio + porta`:

- `http://localhost:8080` e `http://localhost:3000` são **origens diferentes** (portas diferentes).
- `http://localhost:8080` e `https://localhost:8080` também são diferentes.

O browser aplica a **Same-Origin Policy**: JavaScript de uma origem não pode ler respostas de outra origem por omissão. É uma proteção essencial: sem ela, qualquer site que visitas poderia ler o teu email num separador aberto.

## 2. CORS: a exceção pedida pelo servidor

Se o frontend estiver em `:5173` e a API em `:3000`, o browser **bloqueia** as respostas, a menos que a API diga explicitamente "aceito pedidos desta origem" com cabeçalhos `Access-Control-Allow-Origin`. Isso é **CORS** (Cross-Origin Resource Sharing).

Tens duas formas de lidar com isto:

1. **Configurar CORS** na API (permitir a origem do frontend). Funciona, mas cada origem nova exige mudança na API, e a configuração errada (`*`) abre buracos.
2. **Não ter origens diferentes**: o browser pensa que tudo vem da mesma origem. É o que fazemos.

## 3. Como fazemos "tudo na mesma origem"

```
browser ──:8080──► nginx ──┬── /         → ficheiros estáticos (HTML/JS/CSS)
                           └── /api/*    → api:3000 (proxy)
```

O browser só fala com `localhost:8080`. O pedido `/api/tasks` é "da mesma origem" que a página. O Nginx é que fala com a API, dentro da rede Docker. **Nenhum CORS é necessário.**

## 4. Reverse proxy: o que é

Um **proxy** fala com o servidor em nome do cliente. Um **reverse proxy** fala com os servidores em nome dos clientes: o cliente vê uma só cara, e por trás há vários serviços.

```nginx
location /api/ {
  proxy_pass http://api:3000;
}
```

Vantagens reais, além de evitar CORS:

- **Um só ponto de entrada**: só a porta 8080 é publicada (vê `ports:` no compose).
- **TLS** (HTTPS) termina aqui, e a API fala HTTP simples por dentro.
- **Balanceamento**: o Nginx pode distribuir por várias réplicas (`upstream`).
- **Cache, compressão, rate limiting**, tudo sem mudar o código da app.

## 5. Lê o `nginx.conf` linha a linha

```nginx
root /usr/share/nginx/html;          # onde estão os ficheiros que o build gerou
location / {
  try_files $uri /index.html;        # 1) tenta o ficheiro; 2) se não existir, index.html
}
```

`try_files` é o que torna isto uma **SPA** (Single Page Application). Imagina que o utilizador escreve `localhost:8080/tarefas/3` diretamente. Não existe um ficheiro `tarefas/3`. Sem `try_files`, o Nginx devolvia `404`. Com ele, devolve `index.html`, e o React (com o seu router, se o tivesse) decide o que mostrar. **Esta é a razão de a SPA funcionar com URLs "profundos".**

```nginx
location /api/ {
  proxy_pass http://api:3000;        # sem caminho no fim → o URI original é preservado
  proxy_set_header Host $host;       # passa o Host original à API
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # IP real do cliente
}
```

**Armadilha clássica:** com um host fixo, se escrevesses `proxy_pass http://api:3000/;` (com barra final), o prefixo `/api/` seria **removido** e a API receberia `/tasks` em vez de `/api/tasks`. Uma barra a mais muda o comportamento.

### Um bug real que apareceu neste projeto: 502 depois de recriar a API

A versão acima (`proxy_pass http://api:3000;`) funcionou durante semanas. Depois recriámos o contentor da API e **todos** os pedidos passaram a dar `502 Bad Gateway`, com a API saudável.

Causa: o Nginx resolve `api` para um IP **uma única vez**, no arranque, e guarda-o para sempre. A API recriada recebeu outro IP (`172.19.0.5` → `172.19.0.8`), e o Nginx continuou a enviar para o antigo. Nos logs do Nginx via-se `upstream: "http://172.19.0.5:3000/..."`. Em produção, isto acontece em **cada deploy** da API.

Correção (o `nginx.conf` atual):

```nginx
resolver 127.0.0.11 valid=10s;      # DNS interno do Docker; volta a perguntar a cada 10 s
location /api/ {
  set $api_upstream api:3000;
  proxy_pass http://$api_upstream;  # com uma variável, o Nginx resolve o nome em cada pedido
}
```

Lição: quando um proxy fala com serviços que mudam de endereço (Docker, Kubernetes, cloud), a resolução de nomes tem de ser dinâmica. É o tipo de problema que nenhum teste unitário apanha e que aparece em incidentes reais. Experiência: reverte para `proxy_pass http://api:3000;`, reconstrói o `web`, depois `docker compose ... up -d --force-recreate api` e vê o 502.

## 6. Dois mundos: desenvolvimento e produção

| | Desenvolvimento (`npm run dev`) | Produção (Docker, Nginx) |
|---|---|---|
| Quem serve o frontend | Vite (`:5173`) | Nginx (`:8080`) |
| Como chega à API | `server.proxy` no `vite.config.js` | `location /api/` no `nginx.conf` |
| Hot reload | sim | não (ficheiros pré-compilados) |

Os dois fazem **a mesma coisa**: reencaminham `/api` para a API. Por isso o código do frontend (`api.js` com `BASE = '/api'`) é **igual** nos dois mundos. Essa é a vantagem: não há `if (dev) ... else ...` no código da app.

## 7. Porque a API não está exposta

No `docker-compose.yml`, a API não tem `ports:`. Só é acessível pela rede interna. Quem a atinge é o Nginx, que é o único que decide o que passa. Isto significa que podes:

- Adicionar regras no Nginx (bloquear `/api/admin`, limitar pedidos) sem tocar na API.
- Ter a API a aceitar só pedidos vindos do Nginx (com um segredo ou uma rede privada).

**Experiência de segurança:**

```bash
curl -i http://localhost:8080/api/health    # 200 — pelo proxy
curl -i http://localhost:3000/api/health    # falha — não está publicada
```

## 8. Cabeçalhos: o que o proxy acrescenta

`X-Forwarded-For` leva o IP do cliente original até à API. Sem isto, a API só vê o IP do Nginx e todos os pedidos parecem vir do mesmo sítio (o que estraga rate limiting e logs). **Mas:** a API só deve confiar neste cabeçalho se **só** o Nginx puder enviar pedidos. Caso contrário, qualquer cliente forja o IP. Confiar em cabeçalhos é uma decisão de segurança, não um detalhe.

---

## Prática: escreve tu

Vais escrever um `nginx.conf` **do zero**, num só ficheiro, em três camadas. O verificador sobe um Nginx a sério em Docker, com o teu ficheiro, mais dois backends "eco" (`api` e `relatorios`) que respondem a dizer **que caminho e que cabeçalhos receberam**. Assim vês exatamente o que o teu proxy encaminhou. Depois faz pedidos com `curl`, como um browser.

**Ficheiro:** `pratica/10-nginx-proxy-e-origem/nginx.conf` (o site estático já está em `site/`)

**Verificar:** `npm run verificar 10` (dentro de `pratica/`, com o Docker a correr). Só uma parte: `npm run verificar 10 estaticos`, `... 10 proxy` ou `... 10 extra`. Antes de tudo, o verificador corre `nginx -t`, que valida a sintaxe e mostra a linha exata de cada erro.

O ficheiro é montado em `/etc/nginx/conf.d/default.conf`, por isso já está **dentro** do bloco `http { }`: escreves `server { ... }` (e, no P3, uma linha antes dele).

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Ficheiros estáticos, SPA e cache (≈30 min)

- `/` e qualquer rota da SPA (`/tarefas/42`) devolvem o `index.html`.
- **Mas** um ficheiro em falta em `/assets/` dá `404`, e não o `index.html`. Se o browser pedir um `.js` e receber HTML, o erro que aparece na consola é incompreensível ("Unexpected token '<'").
- `/assets/*` com `Cache-Control: public, max-age=31536000, immutable` (um ano: os ficheiros do Vite têm um hash no nome, por isso um ficheiro novo tem sempre um nome novo).
- o `index.html` com `Cache-Control: no-cache` ("guarda, mas confirma sempre se mudou"), para um deploy novo aparecer logo.

**Sintaxe que vais praticar:** `server`, `listen`, `root`, `index`, `location /` e `location /assets/`, `try_files $uri /index.html` e `try_files $uri =404`, `add_header ... always`.

### P2 · Reverse proxy com dois backends (≈30 min)

- `/api/...` vai para o backend `api` (porta 3000), com o caminho **intacto**.
- `/api/relatorios/...` vai para o backend `relatorios` (é o prefixo mais longo que ganha, como no `nginx.conf` do projeto com o `/api/activity/`).
- os backends recebem `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto` (secção 8).
- o verificador **recria** a API com outro IP: o teu Nginx tem de a encontrar sozinho (relê o comentário do `resolver` em `src/web/nginx.conf`: é exatamente o bug do 502 que aconteceu neste projeto).
- com a API em baixo, a resposta é `502` com um corpo **JSON** `{"error": "..."}`, e não a página HTML do Nginx: o frontend espera sempre JSON de `/api`.

**Sintaxe que vais praticar:** `resolver`, `set $variavel ...`, `proxy_pass http://$variavel`, `proxy_set_header`, `$host`/`$remote_addr`/`$proxy_add_x_forwarded_for`/`$scheme`, `error_page 502 = @nome`, `location @nome`, `default_type`, `return 502 '...'`.

### P3 · Segurança e desempenho (≈25 min)

- **todas** as respostas, incluindo `404` e erros, com `X-Content-Type-Options: nosniff` e `X-Frame-Options: DENY`.
- `gzip` para CSS, JavaScript e JSON.
- em `/api/`, corpos acima de 1 KB dão `413`.
- em `/api/`, um **limite de pedidos** por IP: 10 por segundo com uma folga de 20 para rajadas; acima disso, `429`. É o treino do exercício [C18](12-exercicios.md#c18-rate-limiting-no-nginx), e a versão Nginx do que escreveste em JavaScript no módulo 05.

**Sintaxe que vais praticar:** `add_header ... always`, `gzip on`, `gzip_types`, `client_max_body_size`, `limit_req_zone` (fora do `server`), `limit_req zone=... burst=... nodelay`, `limit_req_status`.

<details>
<summary>Pista (lê só se o teste do <code>nosniff</code> no <code>/</code> não passar)</summary>

É a armadilha mais famosa do Nginx: um `add_header` dentro de um `location` **anula todos** os `add_header` herdados do `server`. Se o `location /` acrescenta o `Cache-Control`, os cabeçalhos de segurança do `server` deixam de aparecer ali, sem aviso. A solução é repeti-los dentro dos `location` que têm `add_header` próprio.
</details>

<details>
<summary>Pista (lê só se o teste da API recriada não passar)</summary>

`proxy_pass http://api:3000;` resolve o nome `api` **uma vez**, no arranque, e guarda o IP para sempre. Com uma **variável** (`set $upstream api:3000; proxy_pass http://$upstream;`), o Nginx é obrigado a resolver o nome em cada pedido, usando o `resolver` (o DNS do Docker está em `127.0.0.11`).
</details>

<details>
<summary>Solução de referência</summary>

```nginx
# Contexto http (este ficheiro já está dentro dele): uma "zona" de memória partilhada com um
# contador por IP. $binary_remote_addr ocupa 4 bytes por IPv4, por isso 10 MB chegam para ~160 mil IPs.
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # DNS interno do Docker, perguntado de novo a cada 5 s (só funciona com proxy_pass por VARIÁVEL).
  resolver 127.0.0.11 valid=5s;

  gzip on;
  gzip_types text/css application/javascript application/json;   # o text/html já vem incluído

  # Cabeçalhos de segurança. "always" = também em respostas de erro (404, 502...).
  # ATENÇÃO: um add_header dentro de um location ANULA todos os add_header herdados do server.
  # Por isso os locations que acrescentam Cache-Control repetem estes dois.
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;

  # P1 · SPA: qualquer rota desconhecida devolve o index.html, que nunca fica em cache sem confirmar
  # (no-cache = "podes guardar, mas pergunta-me sempre se mudou"). Assim um deploy novo aparece logo.
  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
  }

  # P1 · Assets com hash no nome (como os do Vite): podem ficar em cache um ano, porque um ficheiro
  # novo tem um nome novo. =404 em vez de /index.html: um JS em falta não pode receber HTML.
  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
  }

  # P2 · O prefixo mais longo ganha: /api/relatorios/... vem aqui, o resto de /api/... vai para o de baixo.
  location /api/relatorios/ {
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 1k;

    set $relatorios_upstream relatorios:3000;
    proxy_pass http://$relatorios_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    error_page 502 503 504 = @backend_indisponivel;
  }

  location /api/ {
    # P3 · Até 10 pedidos/s por IP, com uma "folga" de 20 para rajadas curtas; o resto leva 429.
    limit_req zone=api burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 1k;   # uma API de tarefas não precisa de corpos grandes

    set $api_upstream api:3000;
    proxy_pass http://$api_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    error_page 502 503 504 = @backend_indisponivel;
  }

  # P2 · Um "location com nome" (@...) só é usado internamente, por error_page. O frontend recebe
  # sempre JSON da API, mesmo quando quem responde é o Nginx.
  location @backend_indisponivel {
    default_type application/json;
    return 502 '{"error":"Serviço indisponível. Tenta outra vez dentro de momentos."}';
  }
}
```
</details>

## Experiências

1. Mede a diferença: `curl -w '%{http_code}\n' -o /dev/null -s http://localhost:8080/` e `.../nonexistent`. O primeiro devolve `index.html` (200) e o segundo também (SPA). Porquê?
2. Remove `try_files` (deixa só `root`), reconstrói o `web`, e acede a `localhost:8080/qualquer-coisa`. O que acontece?
3. Faz `docker compose ... stop api` e depois `curl localhost:8080/api/tasks`. Que código recebes? Quem o gera: a API ou o Nginx? (Pista: `502 Bad Gateway`.)

## Perguntas de pensamento crítico

1. Um colega diz: "vamos pôr `Access-Control-Allow-Origin: *` na API e acabamos com o problema". O que estás a abrir? Quando é que `*` é aceitável?
2. Porque é que o frontend usa `/api` (caminho relativo) e não `http://localhost:3000/api` (absoluto)? O que quebraria em produção com o URL absoluto?
3. Se a API demorar mais de 60s a responder, o que faz o Nginx? (Pista: `proxy_read_timeout`.) O que vê o utilizador? E o servidor da API continua a trabalhar?

<details>
<summary>Resposta</summary>

1. `*` diz "qualquer site pode ler as respostas da minha API a partir do browser de um utilizador autenticado". Em APIs públicas sem cookies, pode ser aceitável. Com autenticação por cookies ou dados privados, é uma vulnerabilidade. Nunca combines `*` com `credentials: true` (o browser nem deixa).
2. O URL absoluto `localhost:3000` só existe na tua máquina. Em produção, o browser do utilizador não tem nada em `localhost:3000`. O relativo `/api` resolve-se para a origem da página, seja ela qual for: `localhost:8080`, `app.empresa.pt`, etc.
3. O Nginx devolve `504 Gateway Timeout` ao cliente. O servidor da API **continua** a processar, porque o Nginx não o cancela por defeito (o pedido já foi enviado). Isto é uma razão para tornar operações lentas assíncronas (módulo 06): responder `202 Accepted` e processar em background.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 10`.

**1.** Porque é que usar o Nginx como proxy evita o problema de CORS entre o frontend e a API?

- a) Não evita, só esconde o erro no browser
- b) O browser vê tudo como a MESMA origem (mesmo host/porta), por isso nunca há um pedido cross-origin
- c) O Nginx desativa a Same-Origin Policy do browser
- d) CORS só existe quando se usa HTTPS

<details><summary>Resposta</summary>

**b) O browser vê tudo como a MESMA origem (mesmo host/porta), por isso nunca há um pedido cross-origin** — O frontend chama /api/tasks como caminho relativo; para o browser, é a mesma origem que a página.

</details>

**2.** Para que serve 'try_files $uri /index.html' numa SPA?

- a) Só melhora a performance de resposta
- b) Faz URLs 'profundos' (ex.: /tarefas/3) devolverem a app (index.html) em vez de 404, deixando o React decidir o que mostrar
- c) Comprime automaticamente as respostas
- d) Protege contra ataques XSS

<details><summary>Resposta</summary>

**b) Faz URLs 'profundos' (ex.: /tarefas/3) devolverem a app (index.html) em vez de 404, deixando o React decidir o que mostrar** — Sem try_files, recarregar a página num URL profundo daria 404 do Nginx.

</details>

**3.** No bug real descrito no módulo, o que fazia o Nginx devolver 502 depois de a API ser recriada?

- a) A API estava simplesmente offline
- b) O Nginx tinha resolvido e guardado o IP antigo da API no arranque, e nunca voltou a pedir um novo (sem DNS dinâmico)
- c) Faltava memória no contentor
- d) Um erro de sintaxe no nginx.conf

<details><summary>Resposta</summary>

**b) O Nginx tinha resolvido e guardado o IP antigo da API no arranque, e nunca voltou a pedir um novo (sem DNS dinâmico)** — A correção foi um 'resolver' com TTL curto e usar uma variável no proxy_pass.

</details>

**4.** Qual a diferença entre os códigos HTTP 401 e 403?

- a) São exatamente o mesmo código com nomes diferentes
- b) 401: não sabemos quem és (sem token ou token inválido); 403: sabemos quem és, mas não tens permissão
- c) 401 é sempre mais grave que 403
- d) 403 só existe em APIs feitas em Java

<details><summary>Resposta</summary>

**b) 401: não sabemos quem és (sem token ou token inválido); 403: sabemos quem és, mas não tens permissão** — É a diferença exata entre a Alice sem papel admin (403) e um pedido sem token (401) no serviço activity.

</details>

**5.** O que torna o proxy_pass sensível ao 'resolver' do Nginx, obrigando-o a resolver o nome em cada pedido?

- a) Usar um endereço IP fixo no proxy_pass
- b) Usar uma VARIÁVEL no lugar do host (ex.: set $api_upstream api:3000; proxy_pass http://$api_upstream)
- c) Usar sempre HTTPS no proxy_pass
- d) É automático em todas as versões do Nginx

<details><summary>Resposta</summary>

**b) Usar uma VARIÁVEL no lugar do host (ex.: set $api_upstream api:3000; proxy_pass http://$api_upstream)** — Com um host fixo, o Nginx resolve o nome só uma vez no arranque.

</details>

<!-- quiz:end -->
