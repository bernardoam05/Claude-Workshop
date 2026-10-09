#!/usr/bin/env bash
# Teste de fumo: percorre o fluxo completo através do proxy
# (web → api → Postgres/Redis/RabbitMQ → worker → Postgres), incluindo autenticação.
# Uso: ./scripts/smoke-test.sh   (com o docker compose já a correr)
#      BASE_URL=http://localhost:8081 ./scripts/smoke-test.sh   (se usaste WEB_PORT=8081)
set -euo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
pass() { echo "✔ $1"; }
fail() { echo "✘ $1" >&2; exit 1; }
json_field() { sed -n "s/.*\"$1\":\"\\{0,1\\}\\([^\",}]*\\).*/\\1/p"; }

# 1) Sem token, a API tem de recusar.
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/tasks")
[ "$CODE" = "401" ] && pass "sem token → 401" || fail "sem token devia dar 401 (deu $CODE)"

# 2) Registar um utilizador de teste e obter token.
EMAIL="smoke-$(date +%s)@teste.pt"
PASSWORD="password-smoke-123"
TOKEN=$(curl -fsS -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json_field token)
[ -n "$TOKEN" ] && pass "registar utilizador ($EMAIL)" || fail "registar utilizador"

# 3) Password errada tem de ser recusada.
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"errada-123\"}")
[ "$CODE" = "401" ] && pass "login com password errada → 401" || fail "login errado devia dar 401 (deu $CODE)"

# 4) Keycloak (se estiver a correr): token emitido pelo Keycloak tem de ser aceite pela API.
#    Usamos o "password grant" só por ser um script; numa app real o login é sempre pelo browser (PKCE).
KC="${KEYCLOAK_URL:-http://localhost:8180}"
if curl -fsS -o /dev/null "$KC/realms/workshop" 2>/dev/null; then
  KC_TOKEN=$(curl -fsS -X POST "$KC/realms/workshop/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=workshop-web -d username=alice -d password=alice-password \
    | json_field access_token)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/tasks" -H "Authorization: Bearer $KC_TOKEN")
  [ "$CODE" = "200" ] && pass "token do Keycloak aceite pela API" || fail "token do Keycloak recusado (HTTP $CODE)"
else
  echo "– Keycloak não está a correr em $KC (passo ignorado)"
fi

AUTH=(-H "Authorization: Bearer $TOKEN")
processed() { curl -fsS "${AUTH[@]}" "$BASE/api/stats" | sed -n 's/.*"processedCompleted":\([0-9]*\).*/\1/p'; }

curl -fsS "$BASE/api/health" | grep -q '"ok"' && pass "health" || fail "health"

TITLE="smoke-$(date +%s)"
ID=$(curl -fsS -X POST "$BASE/api/tasks" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"$TITLE\"}" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
[ -n "$ID" ] && pass "criar tarefa (id=$ID)" || fail "criar tarefa"

curl -fsS "${AUTH[@]}" "$BASE/api/tasks" | grep -q "$TITLE" && pass "listar tarefas" || fail "listar tarefas"

BEFORE=$(processed)
curl -fsS -X PATCH "$BASE/api/tasks/$ID" "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"done":true}' >/dev/null
pass "concluir tarefa"

# O worker é assíncrono: esperamos que o contador de eventos processados suba (consistência eventual).
OK=""
for _ in $(seq 1 20); do
  AFTER=$(processed)
  if [ "$AFTER" -gt "$BEFORE" ]; then OK=1; break; fi
  sleep 1
done
[ -n "$OK" ] && pass "worker processou o evento ($BEFORE → $AFTER)" || fail "o worker não processou o evento a tempo"

# 5) Kafka + serviço Spring Boot (activity), se estiverem a correr. Precisa do Keycloak (papel admin).
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/activity/summary")
if [ "$CODE" = "401" ]; then
  pass "activity sem token → 401"
  kc_token() {
    curl -fsS -X POST "$KC/realms/workshop/protocol/openid-connect/token" \
      -d grant_type=password -d client_id=workshop-web -d username="$1" -d password="$1-password" | json_field access_token
  }
  ALICE=$(kc_token alice); CARLA=$(kc_token carla)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/activity/summary" -H "Authorization: Bearer $ALICE")
  [ "$CODE" = "403" ] && pass "activity com alice (sem papel admin) → 403" || fail "alice devia dar 403 (deu $CODE)"

  total_events() {
    curl -fsS "$BASE/api/activity/summary" -H "Authorization: Bearer $CARLA" | sed -n 's/.*"totalEvents":\([0-9]*\).*/\1/p'
  }
  BEFORE=$(total_events)
  pass "activity com carla (admin) → 200 (totalEvents=$BEFORE)"
  curl -fsS -X POST "$BASE/api/tasks" "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"title":"via kafka"}' >/dev/null

  # API → Kafka → Spring Boot → Postgres. Também é assíncrono: esperamos.
  OK=""
  for _ in $(seq 1 20); do
    AFTER=$(total_events)
    if [ "$AFTER" -gt "$BEFORE" ]; then OK=1; break; fi
    sleep 1
  done
  [ -n "$OK" ] && pass "Kafka → serviço Spring processou o evento ($BEFORE → $AFTER)" || fail "o serviço activity não recebeu o evento do Kafka"
else
  echo "– serviço activity não está disponível (HTTP $CODE); passos de Kafka ignorados"
fi
