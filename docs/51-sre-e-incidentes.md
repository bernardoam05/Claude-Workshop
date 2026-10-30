# 51 · SRE e gestão de incidentes

**Objetivo:** perceber como as equipas de operações decidem **quanto** fiável um serviço deve ser, e o que fazem quando ele falha: SLI, SLO e SLA; orçamento de erro; alertas pela taxa de queima em vez de por limiares; plantões; resposta a incidentes; e postmortems sem culpas.

**Ficheiros para ler:** `src/api/src/app.js` (a rota `/api/health`: o que o serviço diz sobre si próprio) e a configuração do Prometheus/Grafana do módulo 19.

**Pré-requisitos:** módulos 19 (métricas e alertas), 47 (traces) e 48 (percentis).

---

## 1. O que é SRE

*Site Reliability Engineering* é o nome que a Google deu, por volta de 2003, a tratar as operações como um problema de engenharia de software: em vez de pessoas a reiniciar servidores à mão, engenheiros que escrevem código para que o sistema se mantenha de pé sozinho, e que **medem** a fiabilidade com números. A ideia central é desconfortável à primeira: **100% de fiabilidade é o objetivo errado**. Os utilizadores não distinguem 99,99% de 100% (a rede deles, o Wi-Fi, o telemóvel falham mais do que isso), e cada "9" a mais custa muito mais e trava as mudanças. A pergunta certa é "quanto fiável tem de ser **para os utilizadores estarem contentes**?", e o que sobra é margem para mudar.

## 2. SLI, SLO e SLA

- **SLI** (*Service Level Indicator*): uma medida do que os utilizadores sentem, quase sempre como uma fração de eventos bons: "a proporção de pedidos à listagem que responderam sem erro do servidor em menos de 300 ms". Mede-se o mais perto possível do utilizador (no balanceador de carga, não dentro do processo, que não vê os pedidos que nem lhe chegaram).
- **SLO** (*Objective*): o alvo para o SLI, numa janela de tempo: "99,9% em 30 dias deslizantes". É um compromisso **interno** da equipa.
- **SLA** (*Agreement*): um contrato com clientes, com consequências (créditos, reembolsos) se não for cumprido. É sempre mais folgado do que o SLO, para haver margem para agir antes de pagar.

Uma nota sobre os erros 4xx: um `404` porque o utilizador escreveu mal o URL não é uma falha do serviço, por isso normalmente conta como bom. Um `429` porque o *rate limit* está mal configurado já é discutível.

| SLO | Indisponibilidade permitida em 30 dias | Por ano |
|---|---|---|
| 99% | 7,2 horas | 3,65 dias |
| 99,9% | 43,2 minutos | 8,8 horas |
| 99,99% | 4,3 minutos | 52,6 minutos |
| 99,999% | 26 segundos | 5,3 minutos |

Com 99,99%, um único deploy mau que demore 5 minutos a reverter gasta o mês inteiro. Por isso cada "9" exige processos diferentes (deploys graduais, reversões automáticas, várias regiões), e não só mais esforço.

## 3. O orçamento de erro

Se o SLO é 99,9%, então 0,1% dos pedidos **podem** falhar: é o **orçamento de erro** (*error budget*). Em 1 000 000 de pedidos por mês, são 1000. Este número muda as conversas:

- enquanto há orçamento, a equipa pode arriscar: lançar funcionalidades, fazer experiências, migrar bases de dados;
- quando o orçamento acaba, a política (combinada **antes**, por escrito) diz o que acontece: congelar lançamentos que não sejam correções, e pôr a equipa a trabalhar na fiabilidade até ele recuperar.

O conflito clássico entre "desenvolvimento quer mudar depressa" e "operações quer estabilidade" passa a ter um árbitro objetivo. E um serviço que gasta sempre **zero** do orçamento também é um sinal: provavelmente está a ser demasiado conservador, ou o SLO é demasiado fácil.

## 4. Alertas: sintomas, não causas

Os alertas antigos são por limiares de causas: "CPU acima de 90%", "disco acima de 80%". Acordam pessoas a meio da noite por coisas que muitas vezes não afetam ninguém (o CPU a 95% durante um *batch* noturno), e falham coisas que afetam (um bug que devolve 500 com o CPU a 10%). A regra do SRE é **alertar sobre sintomas que os utilizadores sentem**, ou seja, sobre o SLO, e usar as métricas de causas para **diagnosticar**, em painéis.

Mas "alertar quando o SLI desce abaixo de 99,9%" também não funciona: numa janela de 5 minutos, um pico de dois erros dispara o alerta; numa janela de 30 dias, um serviço completamente em baixo demora horas a fazer descer a média. A solução é a **taxa de queima** (*burn rate*): a que velocidade se está a gastar o orçamento.

```
taxa de queima = (fração de pedidos maus) / (fração permitida pelo SLO)
```

Com uma taxa de 1, o orçamento acaba exatamente no fim dos 30 dias. Com 14,4, gasta-se 2% do orçamento mensal numa hora (14,4 × 1h / 720h = 2%): vale a pena acordar alguém. O livro de exercícios de SRE da Google recomenda **várias janelas**, cada uma com uma janela longa (o problema é significativo) e uma curta (ainda está a acontecer, para o alerta parar assim que o problema acaba):

| Janela longa | Janela curta | Taxa | Ação | Significa |
|---|---|---|---|---|
| 1 h | 5 min | 14,4 | página (acordar alguém) | 2% do orçamento numa hora |
| 6 h | 30 min | 6 | página | 5% em seis horas |
| 3 dias | 6 h | 1 | ticket (ver no horário de trabalho) | 10% em três dias |

No Prometheus (módulo 19), isto escreve-se com *recording rules* para as taxas em cada janela e uma regra de alerta que as combina; ferramentas como o Sloth ou o Pyrra geram tudo a partir da definição do SLO.

## 5. Plantões (on-call)

Alguém tem de responder aos alertas. Um plantão saudável tem:

- **rotação** justa (uma semana de cada vez, pelo menos 6 a 8 pessoas para não ser esgotante), com um segundo nível (*escalation*) se o primeiro não responder em X minutos;
- **poucos alertas, todos acionáveis**: cada página deve exigir uma ação humana inteligente agora. Um alerta que se ignora "porque dispara sempre" treina as pessoas a ignorar alertas, e um dia ignoram o verdadeiro (*alert fatigue*);
- **runbooks**: para cada alerta, uma página com o que significa, como confirmar, e os primeiros passos (com os comandos). O link vai no próprio alerta;
- **compensação** e tempo para corrigir as causas dos alertas, não só para os apagar.

## 6. Resposta a incidentes

Um incidente é qualquer coisa que gasta o orçamento depressa ou afeta clientes. A resposta organizada (inspirada no *Incident Command System* dos bombeiros) separa papéis, para não ficarem dez pessoas a mexer no mesmo servidor:

- **Comandante do incidente** (*incident commander*): coordena, decide, não mexe no teclado. Garante que alguém está em cada frente.
- **Operações**: quem investiga e muda o sistema.
- **Comunicação**: atualiza a página de estado e as pessoas interessadas (suporte, gestão) a intervalos regulares, para ninguém interromper quem está a trabalhar.
- **Escrivão**: regista a cronologia (o que se viu, o que se fez, a que horas), que vai ser preciosa para o postmortem.

A primeira prioridade é **mitigar**, não perceber: reverter o último deploy, desligar a *feature flag*, desviar o tráfego para outra região. A causa investiga-se depois, com o serviço de pé. A **severidade** (SEV1, SEV2...) decide quem é chamado e com que urgência, e define-se com critérios combinados antes (fração de utilizadores afetados, perda de dados, se há contorno).

Duas métricas resumem a capacidade de resposta: o **MTTD** (*mean time to detect*, quanto se demora a perceber que há um problema; se forem os clientes a avisar, é longo) e o **MTTR** (*mean time to restore*, quanto se demora a repor o serviço). Com o tempo entre falhas, dão a fiabilidade: falhar raramente ajuda, mas recuperar depressa ajuda tanto ou mais.

## 7. Postmortems sem culpas

Depois de cada incidente relevante, escreve-se um **postmortem**: o que aconteceu, o impacto, a cronologia, as causas e as ações para não voltar a acontecer. O princípio mais importante é ser **sem culpas** (*blameless*): parte-se do princípio de que todos fizeram o melhor que podiam com a informação que tinham, e pergunta-se **o que no sistema** deixou o erro acontecer. "O Rui correu a migração errada" não ensina nada e faz com que, da próxima vez, as pessoas escondam os erros. "O pipeline deixa correr migrações sem as testar com dados de volume real" leva a uma correção que protege toda a gente.

As causas raramente são uma só (a ideia de "a causa raiz" engana: normalmente há várias condições que se juntaram). E cada ação tem um **dono** e uma **data**: um postmortem com "devíamos melhorar a monitorização" e sem dono é uma lista de desejos que ninguém vai cumprir.

## 8. Toil

*Toil* é o trabalho operacional manual, repetitivo, automatizável, sem valor duradouro, e que cresce com o tamanho do serviço: reiniciar processos à mão, criar contas, rodar certificados. O SRE propõe um limite (a Google usa 50% do tempo) e trata o resto como tempo para eliminar o *toil* com código. O módulo 24 (scripts de Bash) e o 20 (CI/CD) são exatamente isso.

## Em resumo

- **100% de fiabilidade é o objetivo errado**: a pergunta é quanto fiável tem de ser para os utilizadores estarem contentes.
- O **SLI** mede o que os utilizadores sentem (a fração de pedidos bons), o **SLO** é o alvo interno e o **SLA** é o contrato, mais folgado.
- O **orçamento de erro** (1 − SLO) é a margem para mudar; quando acaba, a equipa trava os lançamentos e trabalha na fiabilidade.
- Alerta-se sobre **sintomas**, pela **taxa de queima** do orçamento, com uma janela longa e uma curta para cada regra.
- Um plantão saudável tem poucos alertas, todos acionáveis, e um **runbook** para cada um.
- Num incidente, há papéis claros e a prioridade é **mitigar**; depois, um **postmortem sem culpas**, com ações que têm dono e data.
- O ***toil*** (trabalho manual repetitivo) elimina-se com código.

---

## Prática: escreve tu

As contas e as regras que sustentam o SRE, escritas como funções: o SLI, o orçamento de erro, a taxa de queima com as regras de várias janelas, a severidade e as métricas de incidentes, e um verificador de postmortems que apanha secções em falta, ações sem dono e linguagem de culpa.

**Ficheiros:** `pratica/51-sre-e-incidentes/` (`slo.js`, `queima.js`, `incidentes.js`, `postmortem.js`)

**Verificar:** `npm run verificar 51` (dentro de `pratica/`). Só um exercício: `npm run verificar 51 slo`, `... 51 queima`, `... 51 incidentes` ou `... 51 postmortem`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · SLI e orçamento de erro (≈20 min)

**Ficheiro:** `slo.js`

O SLI a partir de uma lista de pedidos (com os 4xx a contar como bons), o orçamento de erro e o que sobra dele, e a tabela da secção 2 como uma função.

**Sintaxe que vais praticar:** `filter`, separadores numéricos (`1_000_000`), contas com frações.

<details>
<summary>Pista</summary>

O orçamento é `(1 - slo) × total`; a fração que sobra é `1 - maus / permitidos`. Cuidado com o caso de um SLO de 100%: o orçamento é zero e a divisão rebenta.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · SLI, SLO e orçamento de erro.

// sli(pedidos, { latenciaMaxMs }) → fração de pedidos "bons" (0..1)
//   Um pedido { estado, ms } é bom se não for um erro do servidor (estado < 500) E tiver demorado
//   no máximo latenciaMaxMs. Os 4xx contam como bons: são erros do cliente, não do serviço.
//   Sem pedidos → 1 (nada correu mal).
export function sli(pedidos, { latenciaMaxMs }) {
  if (pedidos.length === 0) return 1;
  const bons = pedidos.filter((p) => p.estado < 500 && p.ms <= latenciaMaxMs).length;
  return bons / pedidos.length;
}

// orcamento({ slo, total, maus }) → { permitidos, gastos, restante }
//   permitidos: quantos pedidos maus o SLO deixa ter neste período ((1 - slo) × total)
//   gastos: os maus que já houve
//   restante: a fração do orçamento que sobra (1 = intacto, 0 = gasto, negativo = SLO violado)
export function orcamento({ slo, total, maus }) {
  const permitidos = (1 - slo) * total;
  const restante = permitidos === 0 ? (maus === 0 ? 1 : -Infinity) : 1 - maus / permitidos;
  return { permitidos, gastos: maus, restante };
}

// indisponibilidadePermitida(slo, dias) → minutos de indisponibilidade total que o SLO permite
//   num período de `dias` dias (ex.: 99,9% em 30 dias → 43,2 minutos).
export function indisponibilidadePermitida(slo, dias) {
  return (1 - slo) * dias * 24 * 60;
}
```
</details>

### P2 · Alertas pela taxa de queima (≈25 min)

**Ficheiro:** `queima.js`

A taxa de queima e a avaliação das três regras da tabela da secção 4, em que cada regra só dispara com a janela longa **e** a curta acima do limite.

**Sintaxe que vais praticar:** um `for...of` sobre uma lista de regras, uma função auxiliar que trata janelas em falta, *template literals*.

<details>
<summary>Pista</summary>

Escreve primeiro uma pequena função `taxa(nome)` que devolve 0 se a janela não existir e, senão, chama `taxaDeQueima` com os dados da janela e o `slo`. Depois, percorre `REGRAS` por ordem e devolve a primeira em que as duas janelas passam o limite.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Taxa de queima (burn rate) e alertas em várias janelas.

// taxaDeQueima({ maus, total, slo }) → a que velocidade se está a gastar o orçamento de erro
//   = (fração de maus) / (fração permitida pelo SLO). 1 = gasta o orçamento exatamente no fim do
//   período; 10 = gasta-o 10 vezes mais depressa. Sem pedidos → 0.
export function taxaDeQueima({ maus, total, slo }) {
  if (total === 0) return 0;
  return maus / total / (1 - slo);
}

// As regras do livro de SRE da Google (Workbook, cap. 5) para um SLO de 30 dias: cada regra
// exige que a janela LONGA e a CURTA estejam ambas acima do limite. A longa prova que o problema
// é significativo; a curta prova que ainda está a acontecer (o alerta desliga-se depressa).
export const REGRAS = [
  { longa: '1h', curta: '5m', limite: 14.4, acao: 'pagina' }, // 2% do orçamento numa hora
  { longa: '6h', curta: '30m', limite: 6, acao: 'pagina' }, // 5% em seis horas
  { longa: '3d', curta: '6h', limite: 1, acao: 'ticket' }, // 10% em três dias
];

// avaliarAlertas(janelas, slo) → { acao: 'pagina' | 'ticket' | null, regra: '1h/5m' | ... | null }
//   janelas: { '5m': { maus, total }, '30m': ..., '1h': ..., '6h': ..., '3d': ... }
//   Devolve a PRIMEIRA regra (pela ordem de REGRAS) cujas duas janelas tenham uma taxa de queima
//   >= limite. Uma janela que falte conta como taxa 0.
export function avaliarAlertas(janelas, slo) {
  const taxa = (nome) => (janelas[nome] ? taxaDeQueima({ ...janelas[nome], slo }) : 0);
  for (const r of REGRAS) {
    if (taxa(r.longa) >= r.limite && taxa(r.curta) >= r.limite) {
      return { acao: r.acao, regra: `${r.longa}/${r.curta}` };
    }
  }
  return { acao: null, regra: null };
}
```
</details>

### P3 · Severidade e MTTD/MTTR (≈20 min)

**Ficheiro:** `incidentes.js`

A classificação de severidade com critérios fixos, e as médias de tempo para detetar e para repor a partir de uma lista de incidentes, com as datas validadas.

**Sintaxe que vais praticar:** parâmetros com valores por omissão na desestruturação, `Date.parse`, desestruturação de um `map`, arredondamento a uma casa decimal.

<details>
<summary>Pista</summary>

`Date.parse` devolve milissegundos; divide por 60 000 para ter minutos. Para arredondar a uma casa: `Math.round(x * 10) / 10`. Valida a ordem com `inicio <= detetado <= resolvido` antes de somar.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Severidade e métricas de incidentes.

// severidade({ fracaoAfetada, perdaDeDados, haContorno }) → 'SEV1' | 'SEV2' | 'SEV3'
//   SEV1: houve perda de dados, ou metade ou mais dos utilizadores afetados
//   SEV2: 5% ou mais afetados e não há contorno (os utilizadores não conseguem fazer a tarefa)
//   SEV3: o resto
export function severidade({ fracaoAfetada, perdaDeDados = false, haContorno = false }) {
  if (perdaDeDados || fracaoAfetada >= 0.5) return 'SEV1';
  if (fracaoAfetada >= 0.05 && !haContorno) return 'SEV2';
  return 'SEV3';
}

// metricas(incidentes) → { mttdMin, mttrMin, total }
//   Cada incidente: { inicio, detetado, resolvido } (datas em texto ISO).
//   mttdMin: média, em minutos, do início até ser detetado (Mean Time To Detect)
//   mttrMin: média, em minutos, do início até ser resolvido (Mean Time To Resolve/Restore)
//   Arredondados a 1 casa decimal. Sem incidentes → { mttdMin: 0, mttrMin: 0, total: 0 }.
//   Um incidente com as datas fora de ordem é um erro de dados: lança um Error.
export function metricas(incidentes) {
  if (incidentes.length === 0) return { mttdMin: 0, mttrMin: 0, total: 0 };
  let somaD = 0;
  let somaR = 0;
  for (const i of incidentes) {
    const [ini, det, res] = [i.inicio, i.detetado, i.resolvido].map((d) => Date.parse(d));
    if (!(ini <= det && det <= res)) throw new Error(`Datas fora de ordem: ${JSON.stringify(i)}`);
    somaD += (det - ini) / 60_000;
    somaR += (res - ini) / 60_000;
  }
  const media = (s) => Math.round((s / incidentes.length) * 10) / 10;
  return { mttdMin: media(somaD), mttrMin: media(somaR), total: incidentes.length };
}
```
</details>

### P4 · Um verificador de postmortems (≈30 min)

**Ficheiro:** `postmortem.js`

Lê um postmortem em Markdown e devolve a lista de problemas: secções em falta, ações sem dono ou data (só na secção "Ações"), nenhuma ação, e expressões que procuram culpados.

**Sintaxe que vais praticar:** `matchAll` com a flag `m` (`^` e `$` por linha), `split` com uma expressão regular, `replace`, `toLowerCase`.

<details>
<summary>Pista</summary>

Para isolar a secção "Ações": parte o texto em `## Ações` e fica com o que vem depois; depois parte isso no próximo `## ` e fica com o que vem antes. As tarefas são as linhas que começam por `- [ ] ` ou `- [x] `.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Um verificador de postmortems.

export const SECOES = ['Resumo', 'Impacto', 'Cronologia', 'Causas', 'Ações'];

// Expressões que procuram um culpado em vez de uma causa. Um postmortem "sem culpas" (blameless)
// pergunta o que no SISTEMA deixou o erro acontecer, não quem o cometeu.
export const EXPRESSOES_DE_CULPA = ['culpa d', 'erro humano', 'devia ter', 'não devia', 'descuido', 'negligência'];

// verificarPostmortem(markdown) → lista de problemas (texto); [] se estiver tudo bem
//   1. Cada secção de SECOES tem de existir como título de nível 2 ("## Resumo"). Por cada uma que
//      falte: "Falta a secção: Resumo".
//   2. Cada linha da secção "Ações" que seja uma tarefa ("- [ ] ..." ou "- [x] ...") tem de ter um
//      dono e uma data, no formato "(@dono, AAAA-MM-DD)". Senão: "Ação sem dono ou data: <texto da linha sem '- [ ] '>".
//   3. A secção "Ações" tem de ter pelo menos uma tarefa: "Sem ações".
//      (se a secção não existir, só aparece o problema 1)
//   4. Por cada expressão de EXPRESSOES_DE_CULPA que apareça no texto (sem distinguir maiúsculas),
//      uma vez: "Linguagem de culpa: <expressão>".
export function verificarPostmortem(markdown) {
  const problemas = [];
  const titulos = [...markdown.matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1]);
  for (const s of SECOES) if (!titulos.includes(s)) problemas.push(`Falta a secção: ${s}`);

  if (titulos.includes('Ações')) {
    const depois = markdown.split(/^## +Ações\s*$/m)[1];
    const corpo = depois.split(/^## /m)[0];
    const tarefas = corpo.split('\n').filter((l) => /^\s*- \[[ x]\] /.test(l));
    if (tarefas.length === 0) problemas.push('Sem ações');
    for (const t of tarefas) {
      if (!/\(@[\w.-]+, \d{4}-\d{2}-\d{2}\)/.test(t)) {
        problemas.push(`Ação sem dono ou data: ${t.replace(/^\s*- \[[ x]\] /, '').trim()}`);
      }
    }
  }

  const minusculas = markdown.toLowerCase();
  for (const e of EXPRESSOES_DE_CULPA) if (minusculas.includes(e)) problemas.push(`Linguagem de culpa: ${e}`);
  return problemas;
}
```
</details>

## Experiências

1. **Um SLO para o workshop:** com a stack a correr e o Prometheus do módulo 19, escreve uma *recording rule* com a fração de pedidos `5xx` da API em 5 minutos e em 1 hora, e uma regra de alerta com a condição `1h/5m` da tabela. Provoca erros (pára o Postgres) e vê quanto tempo demora a disparar e a desligar depois de o voltares a ligar.
2. **Uma política de orçamento de erro:** escreve, numa página, o SLO do serviço de tarefas e o que a equipa faz quando o orçamento chega a 50% e a 0%. Quem decide as exceções?
3. **Um runbook:** escolhe um alerta (por exemplo, "a fila do RabbitMQ não pára de crescer", módulo 06) e escreve o runbook: o que significa, como confirmar (comandos), primeiras ações, quando escalar.
4. **Um postmortem a sério:** lê um postmortem público (a GitLab publicou o da perda de dados de 2017; a Cloudflare publica vários por ano no blogue). Identifica as várias condições que se juntaram e verifica se as ações têm dono.

## Perguntas de pensamento crítico

1. O gestor de produto pede um SLO de 100% para o serviço de tarefas. Como lhe explicas que é a escolha errada?
2. Porque é que um alerta "CPU acima de 90% durante 5 minutos" é pior do que um alerta pela taxa de queima do SLO?
3. Num postmortem, alguém escreve "causa raiz: o engenheiro de plantão não leu o runbook". O que está errado com esta frase, e como a reescrevias?

<details>
<summary>Respostas</summary>

1. Porque os utilizadores não notam a diferença entre 100% e, por exemplo, 99,9% (a rede, os dispositivos e os outros serviços que usam falham mais do que isso), porque cada "9" a mais custa muito mais (redundância, processos, várias regiões), e porque um SLO de 100% significa um orçamento de erro zero: qualquer mudança é um risco inaceitável, por isso a equipa deixa de poder lançar funcionalidades. O SLO certo é o nível a partir do qual os utilizadores deixam de estar contentes, e a margem até lá é o que permite mudar.
2. Porque mede uma causa possível e não o que os utilizadores sentem: dispara quando o CPU está alto sem afetar ninguém (um processo em *batch*), e não dispara com o serviço a devolver erros com o CPU baixo. Ensina as pessoas a ignorar alertas. A taxa de queima mede diretamente a experiência dos utilizadores, e as janelas longa e curta fazem com que só dispare quando o problema é significativo e ainda está a acontecer.
3. Procura um culpado em vez de uma causa (não é *blameless*), e para numa pessoa em vez de perguntar porque é que o sistema deixou isso acontecer: o runbook era fácil de encontrar? Estava no alerta? Estava atualizado? A pessoa tinha formação, ou estava no primeiro plantão às 4 da manhã? Reescrito: "o alerta não tinha link para o runbook, e o runbook descrevia a versão antiga do serviço; ação: pôr o link em todos os alertas e rever os runbooks a cada trimestre (dono, data)".
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 51`.

**1.** Qual é a diferença entre um SLO e um SLA?

- a) São sinónimos
- b) O SLO é um objetivo interno; o SLA é um contrato com clientes, com consequências, e é mais folgado
- c) O SLA é interno; o SLO é o contrato
- d) O SLO mede a latência e o SLA a disponibilidade

<details><summary>Resposta</summary>

**b) O SLO é um objetivo interno; o SLA é um contrato com clientes, com consequências, e é mais folgado** — O SLO é mais exigente do que o SLA para haver margem para agir antes de pagar penalizações.

</details>

**2.** Com um SLO de 99,9% e 2 000 000 de pedidos num mês, quantos pedidos maus permite o orçamento de erro?

- a) 200
- b) 2000
- c) 20 000
- d) 999

<details><summary>Resposta</summary>

**b) 2000** — (1 − 0,999) × 2 000 000 = 2000.

</details>

**3.** Como se chama a razão entre a fração de pedidos maus e a fração permitida pelo SLO (em inglês)?

<details><summary>Resposta</summary>

**burn rate** — Uma taxa de 1 gasta o orçamento exatamente no fim do período; 14,4 gasta 2% numa hora.

</details>

**4.** Porque é que os alertas por taxa de queima usam uma janela longa E uma curta?

- a) Para gastar menos memória
- b) A longa confirma que o problema é significativo; a curta que ainda está a acontecer, para o alerta parar depressa
- c) Por compatibilidade com o Prometheus
- d) Para alertar duas vezes

<details><summary>Resposta</summary>

**b) A longa confirma que o problema é significativo; a curta que ainda está a acontecer, para o alerta parar depressa** — Só a longa demoraria a desligar; só a curta dispararia com qualquer pico.

</details>

**5.** Numa resposta a incidente, qual é a primeira prioridade?

- a) Encontrar a causa raiz
- b) Mitigar (reverter, desligar a flag, desviar tráfego) e repor o serviço
- c) Escrever o postmortem
- d) Encontrar quem fez o deploy

<details><summary>Resposta</summary>

**b) Mitigar (reverter, desligar a flag, desviar tráfego) e repor o serviço** — A causa investiga-se depois, com o serviço de pé.

</details>

<!-- quiz:end -->
