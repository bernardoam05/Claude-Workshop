# 48 · Testes de carga com k6

**Objetivo:** saber medir quanto uma aplicação aguenta antes de partir, e porquê: escrever testes de carga com o k6, ler os resultados (percentis, débito, taxa de erros), escolher o tipo de teste certo, e encontrar o gargalo quando os números são maus.

**Ficheiros para ler:** `pratica/48-testes-de-carga/servidor.js` (a API sob teste) e o `pesquisa.js` (o problema do P3).

**Pré-requisitos:** módulos 01 (HTTP e o event loop), 19 (métricas e percentis) e 37 (system design).

---

## 1. Porque é que os testes unitários não chegam

Os testes dos outros módulos respondem a "está certo?". Um teste de carga responde a outras perguntas:

- Quantos pedidos por segundo aguenta a API antes de a latência disparar?
- Com 200 utilizadores em simultâneo, quanto tempo espera o mais azarado?
- O que parte primeiro: o CPU da API, as ligações à base de dados, a memória?
- Depois de 8 horas a correr, a memória continua estável, ou há uma fuga?

Uma função que demora 5 ms passa em todos os testes unitários. Com 100 pedidos por segundo e uma só thread de JavaScript, é meio segundo de CPU por segundo: a API fica metade do tempo sem atender mais nada. Só um teste de carga mostra isso **antes** de ser o Black Friday a mostrá-lo.

## 2. Os números que importam

| Medida | O que é | Porque importa |
|---|---|---|
| **Débito** (*throughput*) | pedidos por segundo atendidos | a capacidade |
| **Latência** em **percentis** | p50, p95, p99: o tempo abaixo do qual estão 50%, 95% e 99% dos pedidos | a experiência dos utilizadores, incluindo os azarados |
| **Taxa de erros** | a percentagem de pedidos falhados (5xx, timeouts) | um sistema "rápido" que falha 10% dos pedidos não é rápido |
| **Saturação** | o quão perto do limite estão o CPU, a memória, as ligações à BD | diz **o que** vai partir |

**Nunca uses a média para latências.** Se 99 pedidos demoram 10 ms e um demora 10 segundos, a média é 110 ms, o que não descreve nenhum pedido real. O p99 (10 s) diz-te que 1 em cada 100 utilizadores teve uma experiência péssima. E 1 em 100 não é pouco: uma página que faz 20 pedidos à API tem 18% de probabilidade de apanhar pelo menos um desses (1 − 0,99²⁰).

Uma relação útil, a **lei de Little**: `pedidos em curso = débito × latência`. Uma API a atender 200 pedidos por segundo, com 50 ms cada, tem em média 10 pedidos em curso a cada instante. Se a latência subir para 500 ms com o mesmo débito, passam a ser 100: 100 ligações à BD abertas, 100 vezes a memória de um pedido. É por isso que a lentidão se alastra: um serviço lento esgota os recursos de quem o chama.

## 3. Os tipos de teste

| Tipo | Forma da carga | Pergunta |
|---|---|---|
| **Smoke** | 1 a 5 utilizadores, 1 minuto | o teste e o sistema funcionam? (antes de qualquer outro) |
| **Carga** (*load*) | a carga esperada, em patamar | aguentamos o tráfego normal, com folga? |
| **Stress** | acima do esperado, a subir | onde parte, e como parte? (com erros claros, ou pendurado?) |
| **Pico** (*spike*) | um salto súbito (de 10 para 500 em segundos) | aguentamos uma campanha, um link viral? E recuperamos? |
| **Resistência** (*soak*) | carga normal durante horas | há fugas de memória, ligações por fechar, discos a encher? |
| **Rutura** (*breakpoint*) | a subir sem parar até falhar | qual é o limite exato? |

## 4. O k6

O **k6** (da Grafana Labs) é uma das ferramentas de testes de carga mais usadas hoje. Os testes são escritos em **JavaScript**, mas correm dentro do k6, um programa em Go, e **não** no Node: não há `require`, `fs` nem `fetch`, há os módulos do k6 (`k6/http`, `k6/metrics`...). É o que lhe permite simular milhares de utilizadores numa só máquina.

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,                 // 50 utilizadores virtuais em simultâneo
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],   // o teste FALHA se não se cumprir
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {            // cada vu repete isto até o tempo acabar
  const r = http.get(`${__ENV.BASE_URL}/api/tarefas`);
  check(r, { 'status 200': (x) => x.status === 200 });
  sleep(1);                             // o "tempo a pensar" de um utilizador real
}
```

```bash
k6 run teste.js                                    # se tiveres o k6 instalado
docker run --rm -i grafana/k6:2.3.0 run - < teste.js   # ou com a imagem oficial (o script vai pelo stdin)
```

As peças:

- **VUs** (*virtual users*): cada um corre a função `default` em ciclo, como um utilizador a usar a app.
- **`check`**: uma verificação que **não para** o teste: conta passagens e falhas (a métrica `checks`).
- **`thresholds`**: os critérios de aprovação. Se algum falhar, o k6 termina com o código de saída 99, e é assim que um teste de carga faz falhar um pipeline de CI (módulo 20).
- **`stages`**: uma rampa de carga (subir, manter, descer).
- **Tags**: etiquetam os pedidos nas métricas. Sem `tags: { name: 'GET /api/tarefas/:id' }`, cada id seria uma URL diferente, e terias milhares de séries.
- **Métricas próprias** (`Trend`, `Counter`, `Rate`, `Gauge`): para medir o que te importa, por exemplo o tempo de uma operação de negócio que envolve vários pedidos.

**Modelo fechado e modelo aberto.** Com `vus`, cada utilizador só faz o pedido seguinte quando o anterior acaba: se o servidor ficar lento, a carga **baixa** sozinha, o que esconde o problema. Na vida real, os utilizadores não esperam uns pelos outros. Para simular isso, o k6 tem os *scenarios* com o executor `constant-arrival-rate` ("200 pedidos por segundo, chegue o servidor ou não"). Para medir limites a sério, é o modelo aberto que conta.

## 5. Desenhar um teste realista

- **Comportamento real:** o mesmo misto de operações que os utilizadores fazem (muitas leituras, algumas escritas), com pausas entre ações, e dados variados (sempre o mesmo id só testa a cache).
- **Um ambiente parecido com o de produção:** os mesmos recursos, os mesmos limites, uma base de dados com um volume de dados realista. Uma query rápida com 100 linhas pode ser lenta com 10 milhões.
- **A máquina que gera a carga não pode ser o gargalo.** Se o k6 estiver a 100% de CPU, estás a medir o k6.
- **Aquecimento:** as primeiras chamadas são mais lentas (caches vazias, JIT, ligações por abrir). Mede depois de uma rampa.
- **Olha para o servidor durante o teste:** o k6 diz-te **que** está lento; as métricas do servidor (o Grafana do módulo 19) e os traces (o módulo de OpenTelemetry) dizem-te **porquê**.
- **Nunca faças testes de carga contra serviços de terceiros** (pagamentos, email), nem contra produção sem combinar com toda a gente. Usa duplos ou ambientes de testes.

## 6. Onde estão normalmente os gargalos

1. **A base de dados:** uma query sem índice, um N+1, transações longas que bloqueiam outras, o *pool* de ligações esgotado (os pedidos ficam à espera de uma ligação livre).
2. **CPU no event loop do Node:** o Node corre o teu JavaScript numa só thread. Uma operação síncrona pesada (ordenar 50 000 elementos, um `JSON.parse` de 20 MB, uma regex catastrófica, `bcrypt` síncrono) **bloqueia todos os pedidos** enquanto corre, incluindo o `/health`. É o problema do P3.
3. **Chamadas em série a outros serviços:** 5 chamadas de 50 ms em série são 250 ms; em paralelo (`Promise.all`), 50 ms.
4. **Falta de cache** para dados que mudam pouco e são muito lidos.
5. **Limites mal configurados:** o *pool* da BD com 10 ligações para 200 pedidos em simultâneo; timeouts por omissão de minutos que deixam os pedidos pendurados; o `ulimit` de ficheiros abertos.

O método é sempre o mesmo: mede, encontra o gargalo, corrige **uma** coisa, mede outra vez. Otimizar sem medir é adivinhar.

## 7. Outras ferramentas

| Ferramenta | Linguagem dos testes | Notas |
|---|---|---|
| **k6** | JavaScript | moderna, boa para CI, integrada com o Grafana |
| **JMeter** | interface gráfica / XML | a mais antiga, muito usada em empresas grandes |
| **Gatling** | Scala, Java, Kotlin, JS | muito eficiente, relatórios HTML bonitos |
| **Locust** | Python | os utilizadores são classes Python |
| **autocannon**, **wrk**, **hey** | linha de comandos | para um endpoint, rapidamente; não para cenários |

---

## Prática: escreve tu

Dois testes de carga escritos por ti, e um gargalo para encontrar e corrigir. Os testes do Node arrancam a API do `servidor.js` (com 50 000 tarefas), correm os teus scripts com o k6 (a imagem Docker oficial, `grafana/k6:2.3.0`) e leem o resumo do fim do teste: os checks, as métricas, e se cada threshold passou.

**Ficheiros:** `pratica/48-testes-de-carga/` (`carga-basica.js` e `rampa.js`, que correm **dentro do k6**, e `pesquisa.js`, que é código da API). O `servidor.js`, o `procura.js` e o `ajuda.js` já estão feitos.

**Verificar:** `npm run verificar 48` (dentro de `pratica/`). Só um exercício: `npm run verificar 48 carga`, `... 48 rampa` ou `... 48 pesquisa`. Precisa do Docker; os três testes de carga demoram cerca de 20 segundos no total.

**À mão:** para correres um script e veres o relatório completo do k6, arranca a API (`node -e "import('./servidor.js').then(m => m.criarServidor().servidor.listen(3300))"`, dentro da pasta) e, noutro terminal: `docker run --rm -i --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:3300 grafana/k6:2.3.0 run - < carga-basica.js`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O primeiro teste de carga (≈20 min)

**Ficheiro:** `carga-basica.js`

5 utilizadores durante 3 segundos, dois checks e três thresholds. Os testes confirmam também que tens a pausa entre pedidos: sem ela, o número de iterações dispara.

**Sintaxe que vais praticar:** `export const options`, `vus`, `duration`, `thresholds` (`p(95)<300`, `rate<0.01`), `export default function`, `http.get`, `check` com várias verificações, `r.json()`, `sleep`, `__ENV`.

<details>
<summary>Pista</summary>

Os nomes das métricas embutidas que vais usar nos thresholds são `http_req_failed`, `http_req_duration` e `checks`. Cada uma recebe uma **lista** de condições, em texto.
</details>

<details>
<summary>Solução de referência</summary>

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '3s',
  thresholds: {
    http_req_failed: ['rate<0.01'],   // menos de 1% de erros
    http_req_duration: ['p(95)<300'], // 95% dos pedidos abaixo de 300 ms
    checks: ['rate>0.99'],
  },
};

// Cada vu repete esta função, sem parar, até o tempo acabar.
export default function () {
  const r = http.get(`${__ENV.BASE_URL}/api/tarefas`);
  check(r, {
    'status 200': (x) => x.status === 200,
    'é uma lista': (x) => Array.isArray(x.json()),
  });
  sleep(0.1);
}
```
</details>

### P2 · Uma rampa com escrita e leitura (≈25 min)

**Ficheiro:** `rampa.js`

Uma subida até 10 utilizadores, um fluxo que cria uma tarefa e a lê pelo id, uma tag para agrupar as leituras, e uma métrica própria com o tempo de criação, com o seu threshold.

**Sintaxe que vais praticar:** `stages`, `http.post` com corpo JSON e cabeçalhos, `__VU` e `__ITER`, `r.json('id')`, `tags: { name }`, `new Trend(nome, true)` e `.add(...)`, `r.timings.duration`.

<details>
<summary>Pista</summary>

O segundo argumento de `new Trend('tempo_criacao', true)` diz que a métrica é um **tempo**. O `r.json('id')` lê um campo do corpo JSON da resposta diretamente.
</details>

<details>
<summary>Solução de referência</summary>

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// true: é uma métrica de TEMPO (o k6 mostra-a em ms e calcula percentis).
const tempoCriacao = new Trend('tempo_criacao', true);

export const options = {
  stages: [
    { duration: '2s', target: 10 }, // subida
    { duration: '3s', target: 10 }, // patamar
    { duration: '1s', target: 0 },  // descida
  ],
  thresholds: {
    tempo_criacao: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const criar = http.post(
    `${__ENV.BASE_URL}/api/tarefas`,
    JSON.stringify({ titulo: `Tarefa ${__VU}-${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(criar, { criada: (r) => r.status === 201 });
  tempoCriacao.add(criar.timings.duration);

  const id = criar.json('id');
  // Sem a tag name, cada /api/tarefas/123 seria uma "URL diferente" nas métricas.
  const ler = http.get(`${__ENV.BASE_URL}/api/tarefas/${id}`, { tags: { name: 'GET /api/tarefas/:id' } });
  check(ler, { lida: (r) => r.status === 200 });

  sleep(0.2);
}
```
</details>

### P3 · Encontrar e corrigir o gargalo (≈30 min)

**Ficheiro:** `pesquisa.js`

A pesquisa da API está certa, mas sob 10 utilizadores o p(95) passa largamente dos 100 ms do `procura.js` (o teste de carga, já escrito). Corre os testes primeiro e lê o valor do p(95) na mensagem. Depois descobre **onde** está o tempo e corrige, sem mudar os resultados: os testes comparam a tua versão com a original para vários termos, e verificam que as tarefas criadas depois entram nas pesquisas seguintes.

**Sintaxe que vais praticar:** medir com `console.time`/`performance.now` dentro de uma função, `WeakMap` como cache, `toLowerCase` e `includes`, sair cedo de um ciclo.

<details>
<summary>Pista</summary>

Conta o trabalho que a função faz **em cada pedido**: copia e ordena 50 000 tarefas com `localeCompare` (o mais caro de longe), e cria uma `RegExp` nova para cada tarefa. A ordenação dá sempre o mesmo resultado enquanto as tarefas não mudam: guarda-a. E se a lista já está ordenada, as primeiras 20 que encontrares são as 20 certas.
</details>

<details>
<summary>Solução de referência</summary>

```js
// Uma cache por array de tarefas: a lista ordenada, com os títulos já em minúsculas.
// Um WeakMap não impede o array de ser libertado da memória quando deixa de ser usado.
const caches = new WeakMap();

function indice(tarefas) {
  let c = caches.get(tarefas);
  // Se entraram tarefas desde a última vez, refaz-se o índice (só nesses pedidos, e não em todos).
  if (!c || c.tamanho !== tarefas.length) {
    const ordenadas = [...tarefas].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt'));
    c = { tamanho: tarefas.length, ordenadas, minusculas: ordenadas.map((t) => t.titulo.toLowerCase()) };
    caches.set(tarefas, c);
  }
  return c;
}

export function procurar(tarefas, texto) {
  const { ordenadas, minusculas } = indice(tarefas);
  const alvo = texto.toLowerCase();
  const resultado = [];
  // A lista já está por ordem: as primeiras 20 que encontrarmos são as 20 certas, e paramos aí.
  for (let i = 0; i < ordenadas.length && resultado.length < 20; i++) {
    if (minusculas[i].includes(alvo)) resultado.push(ordenadas[i]);
  }
  return resultado;
}
```

A cache é invalidada quando o número de tarefas muda. Chega para esta API, que só acrescenta tarefas. Numa API que também edita títulos ou apaga tarefas, a cache teria de ser invalidada nessas operações também (o problema da invalidação, outra vez, como no módulo 05), ou a pesquisa iria para a base de dados, com um índice.
</details>

## Experiências

1. **O event loop bloqueado:** com a `pesquisa.js` original, arranca a API à mão e corre o `procura.js`. Ao mesmo tempo, noutro terminal, faz `time curl http://localhost:3300/health` várias vezes. O `/health` não faz nada, mas demora: porquê?
2. **Média contra percentis:** corre o `carga-basica.js` à mão e compara o `avg`, o `p(90)`, o `p(95)` e o `max` do `http_req_duration`. Agora acrescenta à API um atraso aleatório raro (`if (Math.random() < 0.02) await new Promise((r) => setTimeout(r, 2000))`) e repete. O que muda mais: a média ou o p99?
3. **Modelo aberto:** troca o `options` do `procura.js` (com a pesquisa lenta) por um cenário `constant-arrival-rate` com `rate: 50` pedidos por segundo durante 10 s (vê a documentação dos *executors* do k6). Compara com os 10 vus: o que acontece à latência quando o servidor não aguenta o ritmo?
4. **Onde parte:** com a pesquisa otimizada, faz um teste de rutura: um `ramping-arrival-rate` de 10 até 2 000 pedidos por segundo em 60 s. A que ritmo começam os erros ou a latência a subir? O que está a 100%?

## Perguntas de pensamento crítico

1. O p50 da API é 20 ms e o p99 é 3 s. O gestor diz que "a API é rápida, a média é 40 ms". Que lhe respondes?
2. Porque é que um teste de carga com `vus` (modelo fechado) pode dizer que está tudo bem quando, em produção, o sistema parte?
3. A equipa quer correr um teste de carga a cada Pull Request, no CI. Que vantagens e cuidados vês?

<details>
<summary>Respostas</summary>

1. Que a média esconde os casos maus: 1% dos pedidos demora 3 segundos, e esse 1% atinge muito mais do que 1% dos utilizadores, porque cada página faz vários pedidos (com 20 pedidos por página, quase 1 em cada 5 visitas apanha um pedido lento). Os objetivos de desempenho escrevem-se em percentis (p95 e p99), e é aí que se procura o problema.
2. Porque cada utilizador virtual espera pela resposta antes de fazer o pedido seguinte: quando o servidor fica lento, a carga baixa sozinha, e o teste nunca o empurra para além do limite. Os utilizadores reais não esperam uns pelos outros, e os pedidos continuam a chegar ao mesmo ritmo; os pedidos em curso acumulam-se (a lei de Little), e o sistema parte. Um executor de ritmo constante (modelo aberto) reproduz isso.
3. Vantagens: apanha regressões de desempenho (uma query sem índice, um ciclo O(n²)) antes do merge, como o CI apanha regressões funcionais. Cuidados: os runners do CI são máquinas partilhadas e variáveis, por isso os números flutuam (usa thresholds com folga e compara com o histórico, em vez de valores absolutos apertados); custa minutos de CI (um teste curto por PR, e um mais longo de noite); e o ambiente tem de ser isolado, nunca produção nem serviços de terceiros.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 48`.

**1.** Porque é que não se usa a média para descrever a latência de uma API?

- a) Porque é difícil de calcular
- b) Porque esconde os casos lentos: 99 pedidos de 10 ms e um de 10 s dão uma média que não descreve nenhum pedido real
- c) Porque o k6 não a mostra
- d) Porque a média é sempre maior que o p99

<details><summary>Resposta</summary>

**b) Porque esconde os casos lentos: 99 pedidos de 10 ms e um de 10 s dão uma média que não descreve nenhum pedido real** — Os objetivos escrevem-se em percentis (p95, p99), que mostram a experiência dos utilizadores azarados.

</details>

**2.** No k6, qual é a diferença entre um check e um threshold?

- a) Nenhuma
- b) Um check verifica cada resposta e só conta passagens/falhas; um threshold é um critério sobre as métricas do teste todo que, se falhar, faz o teste falhar
- c) Um threshold só serve para o CPU
- d) Um check para o teste no primeiro erro

<details><summary>Resposta</summary>

**b) Um check verifica cada resposta e só conta passagens/falhas; um threshold é um critério sobre as métricas do teste todo que, se falhar, faz o teste falhar** — É o threshold que dá o código de saída 99 e faz falhar um pipeline de CI.

</details>

**3.** Uma API Node fica lenta sob carga e até o /health (que não faz nada) demora. Qual é o suspeito mais provável?

- a) A rede
- b) Uma operação síncrona pesada que bloqueia o event loop (a única thread de JavaScript)
- c) O DNS
- d) O tamanho dos cabeçalhos

<details><summary>Resposta</summary>

**b) Uma operação síncrona pesada que bloqueia o event loop (a única thread de JavaScript)** — Enquanto o código síncrono corre, nenhum outro pedido é atendido; foi o problema da pesquisa do P3.

</details>

**4.** Que lei relaciona os pedidos em curso, o débito e a latência (pedidos em curso = débito × latência)?

<details><summary>Resposta</summary>

**little** — Se a latência sobe 10 vezes com o mesmo débito, há 10 vezes mais pedidos em curso: ligações, memória, threads.

</details>

**5.** Que tipo de teste usarias para encontrar uma fuga de memória?

- a) Smoke
- b) Pico (spike)
- c) Resistência (soak): carga normal durante horas
- d) Rutura

<details><summary>Resposta</summary>

**c) Resistência (soak): carga normal durante horas** — As fugas só aparecem com o tempo; um teste curto não as mostra.

</details>

<!-- quiz:end -->
