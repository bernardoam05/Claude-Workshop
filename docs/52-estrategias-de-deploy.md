# 52 · Estratégias de deploy

**Objetivo:** pôr versões novas em produção sem parar o serviço e com um caminho rápido de volta: *rolling*, azul/verde, canário, *feature flags*, e migrações de base de dados em "expandir/contrair". E perceber a ideia que as une: **separar o deploy do lançamento**.

**Ficheiros para ler:** `.github/workflows/ci.yml` (o pipeline do módulo 20), `config/docker-compose.yml` e os *Deployments* do Kubernetes do módulo 32.

**Pré-requisitos:** módulos 20 (CI/CD), 32 (Kubernetes) e 51 (SLO e taxa de queima).

---

## 1. O problema

A forma mais simples de fazer deploy é parar a versão antiga e arrancar a nova. Isso dá alguns segundos (ou minutos) sem serviço, e se a versão nova estiver estragada, toda a gente a vê até alguém reparar e voltar atrás. Os números do módulo 51 mostram o custo: com um SLO de 99,9%, há 43 minutos de indisponibilidade por mês, e meia dúzia de deploys maus gastam tudo.

As estratégias deste módulo atacam três coisas: **sem paragem** (as duas versões coexistem durante a troca), **raio de explosão pequeno** (se correr mal, só uma parte dos utilizadores vê) e **reversão rápida** (voltar atrás em segundos, não com um novo deploy).

## 2. Rolling update

É o que o Kubernetes faz por omissão num *Deployment* (módulo 32): substitui as réplicas uma a uma (ou algumas de cada vez), e só passa à seguinte quando a nova está pronta (a *readiness probe* diz que sim).

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1          # no máximo 1 réplica a mais durante a troca
    maxUnavailable: 0    # nunca menos réplicas prontas do que o pedido
```

É barato (não precisa do dobro das máquinas) e não tem paragem. Mas durante a troca **as duas versões servem tráfego ao mesmo tempo**, misturadas, e o mesmo utilizador pode saltar de uma para a outra entre pedidos. E reverter é outro *rolling update*, no sentido contrário (`kubectl rollout undo`), que demora o mesmo.

## 3. Azul/verde

Há duas instalações completas: a **azul** (a atual, com o tráfego) e a **verde** (a nova, sem tráfego). Faz-se o deploy na verde, testa-se à vontade (testes de fumo, com o tráfego interno), e depois muda-se o balanceador de carga de uma vez para a verde. A azul fica ligada, sem tráfego, durante algum tempo: se algo correr mal, **reverter é mudar o balanceador de volta**, em segundos, sem deploy nenhum.

O custo é o dobro dos recursos durante a troca (na cloud, só durante esse tempo). E há um problema comum a todas as estratégias, que fica para a secção 6: a base de dados é partilhada pelas duas cores.

## 4. Canário

O nome vem dos canários que os mineiros levavam para as minas: se o canário deixava de cantar, havia gás. Aqui, a versão nova recebe primeiro uma **pequena percentagem** do tráfego (1%, depois 5%, 25%, 100%) e, em cada passo, comparam-se as suas métricas com as da versão atual **no mesmo período**: taxa de erros, p99 da latência, e métricas de negócio (as encomendas não caíram?). Se estiver pior, reverte-se automaticamente; se estiver igual, sobe-se a percentagem.

Dois detalhes que fazem a diferença:

- **Divisão estável por utilizador**, e não por pedido. Se cada pedido fosse sorteado, o mesmo utilizador saltaria entre versões a meio de um fluxo (por exemplo, um formulário em dois passos). Usa-se um **hash** do id do utilizador: o mesmo id cai sempre no mesmo "balde" de 0 a 99, em qualquer servidor, sem guardar estado. Ao subir de 5% para 20%, quem já estava na versão nova continua lá.
- **Esperar por dados suficientes** antes de decidir. Com 50 pedidos, um erro a mais parece um desastre.

Ferramentas como o Argo Rollouts e o Flagger automatizam isto no Kubernetes: sobem a percentagem por passos e consultam o Prometheus para decidir.

## 5. Feature flags

As estratégias anteriores controlam **que versão do código** corre. As *feature flags* controlam **que funcionalidades** estão ligadas, dentro da mesma versão:

```js
if (flags.ativa('novo-checkout', { id: utilizador.id, pais: utilizador.pais })) {
  return checkoutNovo(carrinho);
}
return checkoutAntigo(carrinho);
```

Isto **separa o deploy do lançamento**: o código novo chega à produção desligado (o deploy passa a ser um não-acontecimento), e liga-se depois, para a equipa, para os testadores, para 10% dos utilizadores de Portugal, para todos. Se correr mal, desliga-se (o *kill switch*) em segundos, sem deploy. Permite também o *trunk-based development* (módulo 16): trabalho incompleto entra no `main` escondido atrás de uma flag, em vez de viver semanas num ramo.

Os custos são reais: cada flag é um `if` com dois caminhos para testar, e flags esquecidas acumulam-se como dívida técnica. Uma flag de lançamento deve ter **data de remoção**: quando chega a 100% e fica estável, apaga-se a flag e o caminho antigo. Há serviços que gerem as flags (LaunchDarkly, Unleash, Flagsmith, ou o padrão aberto OpenFeature); o essencial é que a avaliação seja local e rápida, e que uma flag desconhecida ou um serviço de flags em baixo nunca rebente a aplicação (devolve um valor por omissão seguro).

## 6. A base de dados: expandir e contrair

Em qualquer destas estratégias há um momento em que a versão antiga e a nova correm **ao mesmo tempo contra a mesma base de dados**. Por isso, uma migração que muda o esquema de forma incompatível (renomear uma coluna, apagar uma, torná-la obrigatória) parte a versão antiga a meio do deploy, e torna a reversão impossível.

A solução é partir cada mudança incompatível em passos compatíveis, o padrão **expandir/contrair** (*expand/contract*, ou *parallel change*). Para renomear `nome` para `titulo`:

| Passo | Esquema | Aplicação |
|---|---|---|
| 1. Expandir | acrescenta `titulo`, opcional | a antiga continua igual |
| 2. Escrita dupla | — | deploy da versão que escreve nas duas colunas e lê de `titulo` (com `nome` como recurso) |
| 3. Preencher | copia `nome` → `titulo` nas linhas antigas, em lotes | — |
| 4. Mudar as leituras | — | deploy da versão que só lê e escreve `titulo` |
| 5. Contrair | `titulo` obrigatória; apaga `nome` | (já ninguém usa `nome`) |

Cada passo é um deploy separado, e em cada um pode-se voltar ao anterior. É mais lento do que um `ALTER TABLE ... RENAME`, mas nunca há um momento em que uma versão em produção não funciona. O preenchimento em lotes importa numa tabela grande: um `UPDATE` de milhões de linhas numa só transação bloqueia linhas durante minutos e gera um pico de escrita (módulo 38).

## 7. Reverter, ou corrigir para a frente

Quando um deploy corre mal, há duas opções: **reverter** (voltar à versão anterior) ou **corrigir para a frente** (*roll forward*: fazer um deploy com a correção). Reverter é quase sempre a primeira escolha, porque a versão anterior é conhecida e já funcionava; corrigir para a frente exige escrever código sob pressão e passar pelo pipeline todo. Só que reverter só é possível se a migração da base de dados for compatível com a versão anterior, e é exatamente isso que o expandir/contrair garante.

## Em resumo

- Uma boa estratégia de deploy dá três coisas: **sem paragem**, **raio de explosão pequeno** e **reversão rápida**.
- O ***rolling update*** troca réplicas uma a uma (o padrão do Kubernetes); o **azul/verde** muda todo o tráfego de uma vez e reverte mudando-o de volta.
- O **canário** manda primeiro uma pequena percentagem (dividida por um **hash estável** do utilizador) e compara as métricas antes de avançar.
- As ***feature flags*** **separam o deploy do lançamento**: o código chega desligado e liga-se aos poucos, ou desliga-se num segundo. Têm data de remoção.
- As mudanças de esquema fazem-se em **expandir/contrair**: passos compatíveis, cada um num deploy, para a versão antiga e a nova funcionarem ao mesmo tempo.
- Reverter é quase sempre melhor do que corrigir sob pressão, e só é possível se a migração for compatível.

---

## Prática: escreve tu

As peças por baixo destas estratégias: a divisão estável de utilizadores e a decisão de um canário, um avaliador de *feature flags*, um encaminhador azul/verde com reversão imediata, e uma migração expandir/contrair a sério, numa base de dados Postgres (o PGlite do módulo 03), com a versão antiga e a nova a funcionar ao mesmo tempo.

**Ficheiros:** `pratica/52-estrategias-de-deploy/` (`canario.js`, `flags.js`, `azulVerde.js`, `expandirContrair.js`)

**Verificar:** `npm run verificar 52` (dentro de `pratica/`). Só um exercício: `npm run verificar 52 canario`, `... 52 flags`, `... 52 azulVerde` ou `... 52 expandirContrair`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Canário (≈25 min)

**Ficheiro:** `canario.js`

Um hash FNV-1a para pôr cada utilizador num balde estável de 0 a 99, e a decisão de esperar, reverter ou promover a partir das métricas das duas versões.

**Sintaxe que vais praticar:** operadores de bits (`^`, `>>> 0`), `Math.imul`, `for...of` sobre uma string, parâmetros por omissão num objeto desestruturado.

<details>
<summary>Pista</summary>

Em JavaScript, os números são *doubles*: uma multiplicação normal de dois números de 32 bits perde precisão. `Math.imul` multiplica como em C (32 bits, com transbordo), e `>>> 0` converte o resultado em inteiro sem sinal.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Deploy canário: escolher quem vai para a versão nova, e decidir se ela é promovida.

// balde(id, sal = '') → um número inteiro de 0 a 99, sempre o mesmo para o mesmo id e sal
//   Usa o hash FNV-1a de 32 bits do texto `${sal}:${id}`, e o resto da divisão por 100.
//   (FNV-1a: h = 2166136261; por cada código de carácter c: h = (h XOR c) × 16777619, em 32 bits
//   sem sinal. Em JS: h ^= c; h = Math.imul(h, 16777619) >>> 0.)
//   Estável é o que importa: o mesmo utilizador fica sempre do mesmo lado, em todos os servidores.
export function balde(id, sal = '') {
  let h = 2166136261;
  for (const c of `${sal}:${id}`) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

// naVersaoNova(id, percentagem, sal) → true se o balde do id for menor do que a percentagem
//   (0 → ninguém; 100 → toda a gente; ao subir de 5 para 20, quem já estava continua).
export function naVersaoNova(id, percentagem, sal = '') {
  return balde(id, sal) < percentagem;
}

// avaliarCanario({ base, canario }, opcoes) → 'esperar' | 'reverter' | 'promover'
//   base e canario: { pedidos, erros, p99Ms } da versão atual e da nova, no mesmo período.
//   opcoes: { minPedidos = 500, margemErro = 0.005, fatorLatencia = 1.2 }
//   - 'esperar' se o canário ainda tiver menos de minPedidos (poucos dados para decidir)
//   - 'reverter' se a taxa de erros do canário passar a da base em mais de margemErro,
//      ou o p99 do canário for maior do que fatorLatencia × o p99 da base
//   - 'promover' no resto
export function avaliarCanario({ base, canario }, { minPedidos = 500, margemErro = 0.005, fatorLatencia = 1.2 } = {}) {
  if (canario.pedidos < minPedidos) return 'esperar';
  const taxa = (v) => (v.pedidos === 0 ? 0 : v.erros / v.pedidos);
  if (taxa(canario) > taxa(base) + margemErro) return 'reverter';
  if (canario.p99Ms > base.p99Ms * fatorLatencia) return 'reverter';
  return 'promover';
}
```
</details>

### P2 · Feature flags (≈20 min)

**Ficheiro:** `flags.js`

Um avaliador de flags com *kill switch*, listas de utilizadores, regras por atributo e percentagens, que nunca rebenta por causa de uma flag desconhecida.

**Sintaxe que vais praticar:** `??` para valores em falta, `some`, `includes`, um objeto com um método devolvido por uma função.

<details>
<summary>Pista</summary>

Segue a ordem dos comentários à letra, com um `return` em cada passo. Para a percentagem, reutiliza o `balde` do P1 com o nome da flag como sal.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Feature flags: separar o deploy (o código chega à produção) do lançamento (os utilizadores veem).
import { balde } from './canario.js';

// criarFlags(flags) → { ativa(nome, contexto, padrao = false) }
//   flags: { [nome]: { ligada, utilizadores = [], regras = [], percentagem = 0 } }
//   contexto: { id, ...atributos } (ex.: { id: 'ana', pais: 'PT', plano: 'pro' })
//   ativa(nome, contexto, padrao) decide, por esta ordem:
//     1. flag desconhecida → padrao (o código nunca pode rebentar por causa de uma flag em falta)
//     2. ligada === false → false (o "kill switch": desliga para toda a gente, de imediato)
//     3. o id está em utilizadores → true (a equipa, os testadores beta)
//     4. alguma regra { atributo, valores } tem contexto[atributo] em valores → true
//     5. balde(contexto.id, nome) < percentagem → true (o nome é o sal: cada flag tem a sua
//        divisão, para os mesmos 10% não ficarem com todas as novidades)
//     6. senão → false
export function criarFlags(flags) {
  return {
    ativa(nome, contexto, padrao = false) {
      const f = flags[nome];
      if (!f) return padrao;
      if (f.ligada === false) return false;
      if ((f.utilizadores ?? []).includes(contexto.id)) return true;
      if ((f.regras ?? []).some((r) => r.valores.includes(contexto[r.atributo]))) return true;
      return balde(contexto.id, nome) < (f.percentagem ?? 0);
    },
  };
}
```
</details>

### P3 · Azul/verde (≈20 min)

**Ficheiro:** `azulVerde.js`

Um encaminhador com duas instalações: troca para a outra só se ela estiver saudável, e reverte de imediato, sem verificações.

**Sintaxe que vais praticar:** *closures* com estado, um *getter* num objeto literal, troca de variáveis com desestruturação (`[a, b] = [b, a]`).

<details>
<summary>Pista</summary>

Guarda duas variáveis: a cor `ativo` e a `anterior` (`null` até à primeira troca). Reverter é trocar as duas.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Azul/verde: duas versões completas lado a lado, e o tráfego muda de uma vez.

// criarAzulVerde({ azul, verde, verificarSaude }) → { get ativo, encaminhar(pedido), trocar(), reverter() }
//   azul e verde: funções async (pedido) → resposta (as duas "instalações")
//   verificarSaude(cor): async → true/false
//   ativo: 'azul' no início
//   encaminhar(pedido): manda o pedido para a cor ativa
//   trocar(): passa o tráfego para a OUTRA cor, mas só se verificarSaude(outra) der true;
//             senão lança um Error e fica tudo como estava. Devolve a nova cor ativa.
//   reverter(): volta à cor anterior SEM verificar a saúde (reverter tem de ser imediato: a anterior
//             estava a funcionar há minutos). Lança um Error se nunca houve troca. Devolve a cor ativa.
export function criarAzulVerde({ azul, verde, verificarSaude }) {
  const instalacoes = { azul, verde };
  let ativo = 'azul';
  let anterior = null;
  const outra = (cor) => (cor === 'azul' ? 'verde' : 'azul');
  return {
    get ativo() {
      return ativo;
    },
    encaminhar(pedido) {
      return instalacoes[ativo](pedido);
    },
    async trocar() {
      const alvo = outra(ativo);
      if (!(await verificarSaude(alvo))) throw new Error(`A instalação ${alvo} não está saudável`);
      anterior = ativo;
      ativo = alvo;
      return ativo;
    },
    reverter() {
      if (!anterior) throw new Error('Não há para onde reverter');
      [ativo, anterior] = [anterior, ativo];
      return ativo;
    },
  };
}
```
</details>

### P4 · Expandir/contrair (≈35 min)

**Ficheiro:** `expandirContrair.js`

Renomear `nome` para `titulo` sem nunca partir a versão antiga: expandir, escrita dupla, preenchimento em lotes, e contrair só quando é seguro.

**Sintaxe que vais praticar:** `ALTER TABLE`, `UPDATE ... WHERE id IN (SELECT ... LIMIT $1)`, `affectedRows`, `db.transaction`.

<details>
<summary>Pista</summary>

O Postgres não aceita `UPDATE ... LIMIT`; o truque é escolher os ids numa subconsulta com `LIMIT`. Repete até um `UPDATE` não mudar nenhuma linha (`affectedRows === 0`). No contrair, a verificação e os `ALTER TABLE` vão na mesma transação: um `throw` lá dentro desfaz tudo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Expandir/contrair: mudar o esquema da base de dados sem parar a aplicação.
// Exemplo: renomear tarefas.nome para tarefas.titulo, com a versão antiga e a nova a correr ao mesmo tempo.

// expandir(db): acrescenta a coluna titulo (texto, PODE ser NULL, para a versão antiga, que não
//   a conhece, continuar a conseguir inserir).
export async function expandir(db) {
  await db.query('ALTER TABLE tarefas ADD COLUMN titulo text');
}

// criarV2(db, titulo) → id: o que a versão nova da aplicação faz para criar uma tarefa durante a
//   transição: escreve nas DUAS colunas (escrita dupla), para a versão antiga continuar a ler o nome.
export async function criarV2(db, titulo) {
  const { rows } = await db.query('INSERT INTO tarefas (nome, titulo) VALUES ($1, $1) RETURNING id', [titulo]);
  return rows[0].id;
}

// preencher(db, { lote }) → quantas linhas atualizou no total
//   Copia nome para titulo nas linhas em que titulo ainda é NULL, em lotes de `lote` linhas por
//   UPDATE (numa tabela grande, um UPDATE único bloquearia tudo durante muito tempo), até não haver mais.
export async function preencher(db, { lote }) {
  let total = 0;
  for (;;) {
    const r = await db.query(
      'UPDATE tarefas SET titulo = nome WHERE id IN (SELECT id FROM tarefas WHERE titulo IS NULL LIMIT $1)',
      [lote],
    );
    if (r.affectedRows === 0) return total;
    total += r.affectedRows;
  }
}

// contrair(db): só depois de nenhuma versão antiga estar a correr.
//   Se ainda houver linhas com titulo NULL, lança um Error e não muda nada.
//   Senão, numa transação: titulo passa a NOT NULL e a coluna nome é apagada.
export async function contrair(db) {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query('SELECT count(*)::int AS n FROM tarefas WHERE titulo IS NULL');
    if (rows[0].n > 0) throw new Error(`Ainda há ${rows[0].n} tarefas sem titulo: corre o preencher`);
    await tx.query('ALTER TABLE tarefas ALTER COLUMN titulo SET NOT NULL');
    await tx.query('ALTER TABLE tarefas DROP COLUMN nome');
  });
}
```
</details>

## Experiências

1. **Rolling update a sério:** com o cluster do módulo 32, muda a imagem de um *Deployment* (`kubectl set image ...`) e acompanha com `kubectl rollout status` e `kubectl get pods -w`. Depois, faz deploy de uma imagem que não existe: o que acontece às réplicas antigas? E com `maxUnavailable: 0`?
2. **Uma flag na API:** usa o teu `criarFlags` na API do workshop para esconder um campo novo na resposta da listagem de tarefas, ligado só para um utilizador. Liga-o a 50% e confirma que cada utilizador vê sempre a mesma resposta.
3. **A migração que parte a produção:** com a stack a correr, renomeia uma coluna com `ALTER TABLE ... RENAME` enquanto fazes pedidos com o k6 (módulo 48). Quantos pedidos falham? Repete com o expandir/contrair.
4. **Canário com o Nginx:** no `nginx.conf`, usa o `split_clients` sobre `$remote_addr` para mandar 10% dos pedidos para uma segunda instância da API.

## Perguntas de pensamento crítico

1. Qual é a diferença entre "fazer deploy" e "lançar", e porque é que separá-los muda a forma como uma equipa trabalha?
2. Porque é que um deploy canário divide os utilizadores com um hash do id, em vez de sortear cada pedido?
3. Um colega quer apagar uma coluna e, no mesmo deploy, a versão da aplicação que deixa de a usar. O que pode correr mal, e como fazias?

<details>
<summary>Respostas</summary>

1. Fazer deploy é pôr o código em produção; lançar é os utilizadores começarem a usar a funcionalidade. Com *feature flags* (ou um canário), o deploy pode ser feito a qualquer hora, várias vezes por dia, sem risco (o código novo está desligado), e o lançamento passa a ser uma decisão de produto, gradual e reversível em segundos sem deploy. Os deploys ficam pequenos e frequentes, o trabalho incompleto pode entrar no ramo principal, e um problema num lançamento resolve-se a desligar uma flag.
2. Para cada utilizador ficar sempre na mesma versão: a sortear por pedido, o mesmo utilizador saltaria entre versões a meio de um fluxo (e veria a interface mudar, ou dados em formatos diferentes). O hash é determinístico, por isso dá o mesmo resultado em todos os servidores sem guardar estado, e ao subir a percentagem quem já estava na versão nova continua lá. Também torna as métricas comparáveis por utilizador.
3. Durante o deploy, a versão antiga continua a correr (num *rolling update* ou num canário, durante minutos) e ainda lê ou escreve a coluna: os pedidos dela falham. E se for preciso reverter, a versão anterior já não funciona, porque a coluna desapareceu. Faz-se em dois deploys: primeiro a versão da aplicação que deixa de usar a coluna (e se for obrigatória, torna-se opcional antes); depois, quando já nenhuma instância da versão antiga corre e não se vai reverter, a migração que a apaga.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 52`.

**1.** Qual é a principal vantagem do azul/verde sobre um rolling update?

- a) Usa menos recursos
- b) Reverter é mudar o balanceador de volta, em segundos, e as versões não se misturam
- c) Não precisa de balanceador
- d) Dispensa testes

<details><summary>Resposta</summary>

**b) Reverter é mudar o balanceador de volta, em segundos, e as versões não se misturam** — A versão anterior continua ligada, sem tráfego; o custo é o dobro dos recursos durante a troca.

</details>

**2.** Num canário, porque se divide o tráfego com um hash do id do utilizador?

- a) Por segurança
- b) Para cada utilizador ficar sempre na mesma versão, em qualquer servidor, sem guardar estado
- c) Porque é mais rápido do que Math.random
- d) Para cifrar o id

<details><summary>Resposta</summary>

**b) Para cada utilizador ficar sempre na mesma versão, em qualquer servidor, sem guardar estado** — E ao subir a percentagem, quem já estava na versão nova continua lá.

</details>

**3.** Como se chama o padrão de migração que parte uma mudança incompatível de esquema em passos compatíveis (em inglês, duas palavras ligadas por /)?

<details><summary>Resposta</summary>

**expand/contract** — Expandir, escrita dupla, preencher, mudar leituras, contrair.

</details>

**4.** O que deve fazer o código quando pede uma feature flag que não existe, ou o serviço de flags está em baixo?

- a) Lançar um erro
- b) Devolver um valor por omissão seguro
- c) Ligar a funcionalidade
- d) Esperar até o serviço voltar

<details><summary>Resposta</summary>

**b) Devolver um valor por omissão seguro** — Uma flag nunca pode ser a razão de a aplicação falhar.

</details>

**5.** Porque é que o preenchimento de uma coluna nova numa tabela grande se faz em lotes?

- a) Porque o SQL não permite UPDATE sem WHERE
- b) Para não bloquear muitas linhas durante muito tempo nem gerar um pico de escrita
- c) Para poupar disco
- d) Porque o Postgres limita o UPDATE a 1000 linhas

<details><summary>Resposta</summary>

**b) Para não bloquear muitas linhas durante muito tempo nem gerar um pico de escrita** — Lotes pequenos, cada um numa transação curta, convivem com o tráfego normal.

</details>

<!-- quiz:end -->
