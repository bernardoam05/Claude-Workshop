# 09 · Nginx, reverse proxy e origem

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
