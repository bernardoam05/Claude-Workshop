# 15 · Autenticação: manual vs Identity Provider (Keycloak)

**Objetivo:** perceber as duas formas de autenticar utilizadores, porque é que as empresas quase sempre usam a segunda, e o que cada uma exige de ti.

**Ficheiros para ler:** `src/api/src/services/authService.js`, `src/api/src/services/oidcVerifier.js`, `src/web/src/oidc.js`, `config/keycloak/realm-workshop.json`, serviço `keycloak` em `config/docker-compose.yml`.

**Experimenta primeiro:** abre a app, clica **Entrar com Keycloak**, entra com `alice` / `alice-password`. Repara no URL durante o login: estás em `localhost:8180`, não na app.

---

## 1. As duas formas, lado a lado

O projeto tem as duas a funcionar ao mesmo tempo. A API aceita os dois tipos de token.

| | Manual (o que fizemos primeiro) | Identity Provider (Keycloak) |
|---|---|---|
| Quem guarda a password | a nossa BD (hash bcrypt) | o Keycloak |
| Quem mostra o ecrã de login | o nosso React | o Keycloak (outra página) |
| Quem emite o token | a nossa API (HS256, segredo partilhado) | o Keycloak (RS256, chave privada) |
| Como a API verifica | com o mesmo segredo | com a chave **pública** (JWKS) |
| MFA, recuperar password, bloquear contas | tens de programar tudo | vem feito, configura-se |
| "Entrar com Google/Microsoft" | tens de programar | configura-se |
| Vários serviços partilham o login (SSO) | difícil | é o objetivo do produto |
| Mais uma peça para operar | não | sim |

**Regra prática nas empresas:** não se escreve autenticação à mão em produção. Usa-se um IdP. Mas tens de perceber o manual para perceber o que o IdP faz por ti, e para saber depurar quando algo falha.

## 2. O vocabulário que vais ouvir no primeiro dia

- **IdP (Identity Provider):** o sistema que sabe quem és. Keycloak, Auth0, Okta, Microsoft Entra ID (antigo Azure AD), AWS Cognito, Google.
- **OAuth 2.0:** protocolo de **autorização**: "esta app pode aceder a X em teu nome". Não diz quem és.
- **OpenID Connect (OIDC):** camada por cima do OAuth 2.0 que acrescenta **identidade** (o `id_token` com quem és). Quando alguém diz "integrar com o Keycloak", quase sempre quer dizer OIDC.
- **SAML:** o protocolo mais antigo (XML), ainda comum em grandes empresas e no setor público. O Keycloak também o fala.
- **Realm:** no Keycloak, um "inquilino" isolado com os seus utilizadores, clientes e regras. Aqui: `workshop`.
- **Client:** uma aplicação registada no IdP. Aqui: `workshop-web`.
- **Cliente público vs confidencial:** um **público** (SPA, app móvel) não consegue guardar segredos, porque o código está no dispositivo do utilizador. Um **confidencial** (backend) tem um `client_secret`.
- **Access token:** o que se envia à API (`Authorization: Bearer ...`). Curto (aqui, 15 minutos).
- **ID token:** diz à **app** quem fez login. **Não** se envia à API.
- **Refresh token:** serve para obter um novo access token sem pedir a password de novo.
- **Claims:** os campos dentro do token: `sub`, `email`, `iss`, `aud`, `exp`, `realm_access.roles`.
- **JWKS:** o endpoint onde o IdP publica as chaves públicas.
- **SSO (Single Sign-On):** entras uma vez e ficas autenticado em todas as apps da empresa.

## 3. O fluxo Authorization Code + PKCE (lê `src/web/src/oidc.js`)

```
Browser (React)                  Keycloak                         API
     │  1. redirect com code_challenge  │                              │
     │─────────────────────────────────▶│                              │
     │      2. utilizador faz login     │                              │
     │◀──────── 3. redirect ?code=... ──│                              │
     │  4. POST /token (code + verifier)│                              │
     │─────────────────────────────────▶│                              │
     │◀──────── access_token ───────────│                              │
     │  5. GET /api/tasks  Authorization: Bearer <access_token>        │
     │────────────────────────────────────────────────────────────────▶│
     │                                  │◀── 6. JWKS (1x, em cache) ───│
     │◀──────────────────────────────────────────────── 7. 200 tarefas │
```

Pontos a perceber, um por um:

- **Porque o redirect?** A password é escrita na página do Keycloak. A nossa app **nunca** a vê. Se a app for comprometida, as passwords não estão lá.
- **`state`:** valor aleatório que geramos e verificamos no regresso. Impede que alguém nos force a aceitar um login que não começámos (CSRF).
- **PKCE (`code_verifier` / `code_challenge`):** como uma SPA não tem `client_secret`, provamos que fomos nós a começar o fluxo enviando o segredo original no passo 4. Quem intercetar o `code` no passo 3 não o consegue trocar.
- **`history.replaceState`:** o `code` é de uso único, e não deve ficar no histórico do browser.
- **Logout:** apagar o token local não chega. O Keycloak tem a sua própria sessão (cookie), e o próximo "Entrar" entraria sem pedir password. Por isso redirecionamos para o endpoint de logout do Keycloak. O teste E2E verifica exatamente isto.

**Fluxos que NÃO deves usar numa app nova:**
- **Implicit flow** (token direto no URL): obsoleto.
- **Password grant** (a app recebe a password e envia-a ao IdP): obsoleto no OAuth 2.1. Está ativo no realm **só** para o teste de fumo (`scripts/smoke-test.sh`), que é um script e não tem browser.

## 4. Como a API verifica um token do Keycloak (lê `oidcVerifier.js`)

```js
jwtVerify(token, jwks, { issuer, audience, algorithms: ['RS256'] });
```

Três verificações, e cada uma corresponde a um ataque:

| Verificação | Se faltasse... |
|---|---|
| assinatura (chaves JWKS) | qualquer pessoa forjava tokens |
| `issuer` | aceitavas tokens de **outro** Keycloak ou de outro realm |
| `audience` (`workshop-api`) | um token emitido para **outra** app da empresa entrava na tua API |
| `algorithms` | um token com `alg: none` ou com o algoritmo trocado podia passar |
| `exp` (verificado automaticamente) | um token roubado servia para sempre |

O `aud` não aparece sozinho: foi preciso um **audience mapper** no cliente (vê `realm-workshop.json`). Este é um erro de configuração muito comum nas empresas: a API exige um `aud` que o IdP não está a pôr no token, e tudo dá 401.

## 5. Dois URLs para o mesmo Keycloak (uma armadilha real)

No `docker-compose.yml`, a API tem:

```yaml
OIDC_ISSUER:   http://localhost:8180/realms/workshop                      # o que o browser vê
OIDC_JWKS_URL: http://keycloak:8080/realms/workshop/protocol/openid-connect/certs   # o que a API alcança
```

O token diz `iss: http://localhost:8180/...` porque foi o browser que falou com o Keycloak. Mas **dentro** do contentor da API, `localhost:8180` não existe. Por isso a API valida o `iss` público e descarrega as chaves pelo nome interno. Em produção acontece o mesmo: `https://auth.empresa.pt` lá fora, e um nome interno no cluster.

## 6. Ligar o utilizador do Keycloak às nossas tarefas

As tarefas têm `user_id` (inteiro, chave estrangeira para `users`). O Keycloak identifica utilizadores com um UUID (`sub`). A solução é o **just-in-time provisioning** (`userRepository.findOrCreateExternal`): no primeiro pedido de um utilizador do Keycloak, criamos uma linha local com `external_id = sub` e sem password.

**Decisão de segurança importante:** se o email do Keycloak já existir numa conta local, **não** ligamos as contas automaticamente. Respondemos 409. Porquê? Se alguém criar no IdP uma conta com o teu email (num IdP mal configurado que não verifica emails), apoderava-se da tua conta local. Ligar contas exige prova de que a pessoa controla ambas.

## 7. Autorização: depois de saber quem és, o que podes fazer?

Autenticação = quem és. Autorização = o que podes fazer. Este projeto só tem uma regra de autorização: **cada um só vê as suas tarefas** (está no SQL, `WHERE user_id = $1`).

Nas empresas, vais ver:
- **RBAC (papéis):** `admin`, `editor`, `viewer`. No Keycloak são *realm roles* ou *client roles*, e aparecem no token em `realm_access.roles`.
- **ABAC / políticas:** regras com atributos ("só o dono ou alguém do mesmo departamento"). Ferramentas: OPA (Open Policy Agent), Cedar, Casbin.
- **401 vs 403:** 401 = não sei quem és (token em falta ou inválido). 403 = sei quem és, mas não podes.

## 8. Alternativas ao Keycloak

| Produto | Tipo | Onde aparece |
|---|---|---|
| **Keycloak** | open source, auto-alojado | empresas que querem controlo e não querem pagar por utilizador; muito usado em Portugal e na Europa |
| **Microsoft Entra ID** | SaaS | empresas com Microsoft 365 (a maioria das grandes) |
| **Auth0 / Okta** | SaaS | startups e produtos SaaS |
| **AWS Cognito / Google Identity Platform / Firebase Auth** | SaaS na cloud | quem já está nessa cloud |
| **Authentik, Zitadel, Ory** | open source | alternativas mais recentes ao Keycloak |

O protocolo é o mesmo (OIDC), por isso o que aprendeste aqui transfere-se. Só muda onde se configura.

---

## Experiências

1. **Decifrar um token:** faz login com Keycloak, abre as DevTools → Application → Local Storage → `workshop-token`. Cola o valor em jwt.io (é só base64, não é segredo, e por isso **nunca** se põem dados sensíveis num JWT). Encontra `iss`, `aud`, `sub`, `exp`.
2. **Partir o audience:** na consola do Keycloak (`localhost:8180`, admin/admin) → realm `workshop` → Clients → `workshop-web` → separador Client scopes → `workshop-web-dedicated` → apaga o mapper `audience-workshop-api`. Faz login outra vez. Que código dá a API? Porquê? Volta a pôr o mapper.
3. **Desativar a Alice:** na consola, Users → alice → Enabled: off. Um token já emitido continua válido? Durante quanto tempo? (Pista: `accessTokenLifespan`.) É por isto que os access tokens são curtos.
4. **Adicionar MFA:** Authentication → Required actions → ativa "Configure OTP" para a Alice. Faz login com uma app de autenticação no telemóvel. Repara que não mudaste uma linha de código.
5. **Keycloak em baixo:** `docker compose ... stop keycloak`. O login manual continua a funcionar? E um token do Keycloak **já emitido**? (A API tem as chaves em cache.)

## Perguntas de pensamento crítico

1. A tua empresa tem 12 microserviços. Compara o esforço de autenticação manual em cada um vs um IdP.
2. O token está no `localStorage`. Que ataque o pode roubar? Que alternativa existe, e porque é que ela exige um backend (padrão **BFF**, Backend-for-Frontend)?
3. O access token dura 15 minutos e não temos refresh token. O que vê o utilizador ao fim de 15 minutos? Como resolverias?

<details>
<summary>Respostas</summary>

1. Manual: cada serviço tem de gerir passwords, ou todos partilham um segredo HS256, e aí qualquer serviço comprometido consegue **emitir** tokens válidos para todos. Com IdP: cada serviço só verifica com a chave pública e nenhum consegue emitir. Um só sítio para MFA, auditoria e desativar contas.
2. XSS: qualquer script injetado na página lê o `localStorage`. Alternativa: o token fica num **backend** (BFF), e o browser só tem um cookie `httpOnly; Secure; SameSite`, que o JavaScript não consegue ler. É o padrão recomendado atualmente para SPAs com dados sensíveis.
3. A próxima chamada dá 401 e a app termina a sessão (está no `App.jsx`). Solução: pedir `offline_access` ou usar o refresh token para renovar silenciosamente antes de expirar. Bibliotecas como `keycloak-js` ou `oidc-client-ts` fazem isto por ti.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 15`.

**1.** No fluxo Authorization Code + PKCE, para que serve o 'code_verifier'?

- a) Para cifrar a password do utilizador
- b) Para provar que foi a MESMA app a iniciar o fluxo e a trocar o código, sem precisar de um client secret (a app é pública)
- c) É só o nome interno do token final
- d) Serve apenas para efeitos de logging

<details><summary>Resposta</summary>

**b) Para provar que foi a MESMA app a iniciar o fluxo e a trocar o código, sem precisar de um client secret (a app é pública)** — Uma SPA não pode guardar um client secret; o PKCE substitui-o.

</details>

**2.** Porque é que a API valida o 'audience' (aud) do token, além da assinatura?

- a) Não é realmente necessário validar o aud
- b) Sem isso, um token emitido para OUTRA aplicação (do mesmo Keycloak) seria aceite por esta API
- c) O aud serve só para efeitos de log
- d) É exatamente o mesmo campo que o issuer

<details><summary>Resposta</summary>

**b) Sem isso, um token emitido para OUTRA aplicação (do mesmo Keycloak) seria aceite por esta API** — O aud garante que o token foi emitido PARA esta API, não para outro cliente do mesmo realm.

</details>

**3.** Que algoritmo assina os tokens do Keycloak (chave pública/privada), diferente do HS256 do login manual?

<details><summary>Resposta</summary>

**rs256** — RS256 permite que várias APIs verifiquem o token sem nunca conhecerem a chave privada.

</details>

**4.** O que é o 'just-in-time provisioning' usado para ligar um login do Keycloak a um utilizador local?

- a) Um processo noturno (cron) que sincroniza todos os utilizadores
- b) Criar a linha local do utilizador no PRIMEIRO pedido autenticado por esse 'sub', sem sincronização antecipada
- c) Um botão de registo manual que o admin tem de clicar
- d) Não existe neste projeto

<details><summary>Resposta</summary>

**b) Criar a linha local do utilizador no PRIMEIRO pedido autenticado por esse 'sub', sem sincronização antecipada** — userRepository.findOrCreateExternal faz exatamente isto, de forma atómica (ON CONFLICT).

</details>

**5.** Porque é que o Keycloak NÃO liga automaticamente uma conta externa a uma conta local com o mesmo email?

- a) Não é tecnicamente possível fazê-lo
- b) Permitiria a alguém com controlo sobre esse email no IdP apoderar-se de uma conta local (account takeover)
- c) É só para simplificar o código do projeto
- d) O protocolo OIDC proíbe-o explicitamente

<details><summary>Resposta</summary>

**b) Permitiria a alguém com controlo sobre esse email no IdP apoderar-se de uma conta local (account takeover)** — Por isso a API responde 409 em vez de ligar as contas silenciosamente.

</details>

<!-- quiz:end -->
