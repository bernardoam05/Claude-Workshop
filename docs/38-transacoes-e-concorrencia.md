# 38 · Transações e concorrência

**Objetivo:** perceber o que acontece quando dois pedidos mexem nos mesmos dados ao mesmo tempo, e saber escrever código que continua certo nessas condições: transações, condições de corrida, bloqueios (`FOR UPDATE`), deadlocks, bloqueio otimista com versões, níveis de isolamento, e os erros de serialização. É a classe de bugs que nenhum teste com um utilizador apanha, e que aparece em produção no dia de mais tráfego.

**Ficheiros para ler:** `src/api/src/db/migrate.js` (usa uma transação) e `src/api/src/repositories/taskRepository.js`.

**Pré-requisitos:** módulos 03 (SQL) e 04 (camadas). O módulo 37 (system design) dá o contexto.

---

## 1. O bug que só aparece com dois utilizadores

```js
const { rows } = await db.query('SELECT disponiveis FROM eventos WHERE id = $1', [id]);
if (rows[0].disponiveis < 1) return 'esgotado';
await db.query('UPDATE eventos SET disponiveis = $1 WHERE id = $2', [rows[0].disponiveis - 1, id]);
await db.query('INSERT INTO compras ...');
```

Com um utilizador, está certo. Com dois, ao mesmo tempo, para o último bilhete:

```
pedido A: SELECT → 1 disponível
pedido B: SELECT → 1 disponível           (A ainda não escreveu)
pedido A: UPDATE disponiveis = 0; INSERT compra
pedido B: UPDATE disponiveis = 0; INSERT compra    → vendeste 2 bilhetes para 1 lugar
```

É uma **condição de corrida** (*race condition*): o resultado depende da ordem em que os pedidos se intercalam. O padrão "ler, decidir, escrever" em passos separados é a causa mais comum, e esconde-se em todo o lado: stock, saldos, lugares, limites de utilização, "o primeiro a chegar ganha". O teste de demonstração do P1 mostra o código acima a vender mais de 10 bilhetes para 10 lugares.

Repara que isto acontece **numa só instância da API**: o Node é single-threaded, mas cada `await` é um ponto onde outro pedido pode avançar. E com várias réplicas (módulo 32), acontece de certeza.

## 2. Transações: ACID

Uma **transação** agrupa várias instruções numa unidade:

```sql
BEGIN;
UPDATE contas SET saldo = saldo - 100 WHERE id = 1;
UPDATE contas SET saldo = saldo + 100 WHERE id = 2;
COMMIT;   -- ou ROLLBACK, para desfazer tudo
```

As garantias, pelas iniciais **ACID**:

| Letra | Garantia | Sem ela |
|---|---|---|
| **A**tomicidade | ou tudo, ou nada | o dinheiro sai de uma conta e não chega à outra (o servidor caiu a meio) |
| **C**onsistência | as regras da BD (`CHECK`, chaves estrangeiras) valem no fim de cada transação | um saldo negativo fica gravado |
| **I**solamento | transações em simultâneo não se veem a meio (com nuances: §5) | uma consulta vê o dinheiro "em trânsito" |
| **D**urabilidade | depois do `COMMIT`, sobrevive a uma falha de energia | perdes uma venda confirmada |

Em Node, com o `pg`, há uma armadilha: o `pool.query` pode usar uma ligação **diferente** em cada chamada, e uma transação vive numa ligação. Para uma transação, pede-se um cliente ao pool e devolve-se sempre:

```js
const cliente = await pool.connect();
try {
  await cliente.query('BEGIN');
  // ... as instruções, todas com o mesmo cliente ...
  await cliente.query('COMMIT');
} catch (e) {
  await cliente.query('ROLLBACK');
  throw e;
} finally {
  cliente.release();   // sem isto, o pool esgota-se ao fim de N pedidos e a API pendura
}
```

Num projeto, isto fica num ajudante (`emTransacao(pool, fn)`), para nunca te esqueceres do `release`.

## 3. Resolver a corrida: três formas

**1. Uma só instrução atómica.** A forma mais simples e mais rápida: ler e decidir dentro do `UPDATE`.

```sql
UPDATE eventos SET disponiveis = disponiveis - 1
WHERE id = $1 AND disponiveis > 0
RETURNING disponiveis;
```

Se não atualizou nenhuma linha, esgotou. O Postgres bloqueia a linha durante o `UPDATE`, e uma segunda transação que queira a mesma linha **espera** e depois reavalia o `WHERE` com o valor novo. Junta-se uma rede de segurança na própria tabela: `CHECK (disponiveis >= 0)`.

**2. Bloqueio pessimista: `SELECT ... FOR UPDATE`.** Quando a decisão é complicada demais para um `WHERE` (verificar regras noutras tabelas, chamar código):

```sql
BEGIN;
SELECT disponiveis FROM eventos WHERE id = $1 FOR UPDATE;   -- bloqueia a linha até ao COMMIT
-- ... decidir, com calma, sabendo que ninguém a muda ...
UPDATE ...; INSERT ...;
COMMIT;
```

As outras transações que pedirem a mesma linha ficam em fila. Simples de raciocinar, mas os pedidos esperam uns pelos outros: mantém estas transações **curtas**, e nunca faças chamadas HTTP lá dentro.

**3. Bloqueio otimista: versões.** Não se bloqueia nada. Cada registo tem uma `versao`; ao gravar, exige-se que ainda seja a que leste:

```sql
UPDATE notas SET titulo = $2, versao = versao + 1 WHERE id = $1 AND versao = $3;
```

Se outra pessoa gravou entretanto, a versão mudou, o `UPDATE` não atualiza nada, e o código sabe que houve um **conflito**: volta a ler e tenta outra vez, ou mostra ao utilizador "esta nota foi alterada por outra pessoa". É o que se usa quando os conflitos são raros e as leituras longas (um formulário aberto durante minutos), e é o que fazem o `ETag`/`If-Match` do HTTP, o `@Version` do JPA (módulo 18) e a escrita condicional do DynamoDB (o módulo de cloud).

| Forma | Quando |
|---|---|
| instrução atómica | a regra cabe num `WHERE` (contadores, stock, saldos) |
| `FOR UPDATE` | a decisão precisa de várias leituras ou de lógica, e a transação é curta |
| otimista | conflitos raros, ou o utilizador está "a editar" durante muito tempo |

## 4. Deadlocks

Duas transferências ao mesmo tempo, uma de A para B e outra de B para A:

```
transação 1: bloqueia A ... e quer B (espera pela 2)
transação 2: bloqueia B ... e quer A (espera pela 1)    → ninguém avança: deadlock
```

O Postgres deteta-o ao fim de um segundo (o `deadlock_timeout`) e cancela uma das transações com o erro **`40P01`**. A prevenção é simples: **bloquear sempre pela mesma ordem** (por exemplo, o id menor primeiro). Se todas as transações pedirem A antes de B, nenhuma pode ficar com B à espera de A.

```sql
SELECT id, saldo FROM contas WHERE id = ANY($1) ORDER BY id FOR UPDATE;
```

## 5. Níveis de isolamento

O "I" do ACID tem graus. O padrão SQL define quatro, e o Postgres implementa três:

| Nível (Postgres) | O que vês | Anomalias possíveis |
|---|---|---|
| **READ COMMITTED** (o por omissão) | cada **instrução** vê o que estava confirmado quando ela começou | a mesma consulta, repetida na transação, pode dar outro resultado |
| **REPEATABLE READ** | a transação inteira vê uma **fotografia** de quando começou | o *write skew* (abaixo); escritas em conflito dão o erro `40001` |
| **SERIALIZABLE** | o resultado é igual ao de **alguma** execução em série das transações | nenhuma; em troca, algumas transações são canceladas com `40001` e têm de ser repetidas |

O ***write skew*** é a anomalia mais traiçoeira, porque cada transação, sozinha, está certa. A regra do hospital: tem de ficar sempre pelo menos um médico de turno. Dois médicos pedem para sair ao mesmo tempo; cada transação conta "2 de turno", conclui que pode sair, e tira-se a si própria. Não escrevem na mesma linha, por isso nenhum bloqueio as impede, e o hospital fica sem ninguém. Em `SERIALIZABLE`, o Postgres deteta que as duas leram o que a outra escreveu, e cancela uma com `40001`. Repetida, essa transação vê "1 de turno" e já não sai.

A regra de ouro do `SERIALIZABLE`: **o código tem de repetir a transação inteira** quando recebe o `40001`. Não é um erro, é o Postgres a dizer "tenta outra vez". É o `emSerializavel` do P4.

## 6. Concorrência fora da base de dados

As mesmas ideias aparecem noutros sítios:

- **Idempotência** (módulo 06): uma mensagem processada duas vezes é a mesma corrida, com tempo pelo meio. Uma chave única na BD (`UNIQUE (evento_id)`) é muitas vezes a melhor proteção.
- **Contadores no Redis** (módulo 05): o `INCR` é atómico; um `GET` seguido de `SET` não é.
- **Bloqueios distribuídos:** para garantir que só uma réplica faz uma tarefa (o *cron* que envia os emails do dia), usa-se um bloqueio partilhado: os *advisory locks* do Postgres (`pg_try_advisory_lock`) são a forma mais simples quando já tens o Postgres.
- **Frontend:** dois cliques rápidos no botão "pagar" são duas compras. Desativa o botão, e protege o backend com uma chave de idempotência (o módulo de pagamentos).

## 7. Como se testa isto

Os testes normais correm um pedido de cada vez, por isso nunca encontram corridas. Para as encontrar:

- **dispara muitos pedidos ao mesmo tempo** (`Promise.all` de 50 compras) e verifica os **invariantes** no fim: "vendidos = 10", "o dinheiro total conserva-se". É o que fazem os testes desta prática;
- contra uma **base de dados a sério**, com várias ligações: uma BD em memória com uma só ligação, ou um *mock*, serializa tudo e esconde o problema;
- e repete-os: uma corrida aparece de vez em quando, não sempre.

---

## Prática: escreve tu

Os quatro problemas deste módulo, contra um **Postgres a sério** (o verificador arranca um `postgres:16-alpine` num contentor e apaga-o no fim), com testes que disparam dezenas de pedidos ao mesmo tempo e verificam os invariantes. Dois dos testes são **demonstrações** que passam desde o início: mostram o problema antes de o resolveres (a compra ingénua a vender bilhetes a mais, e o *write skew* a deixar o hospital sem médicos).

**Ficheiros:** `pratica/38-transacoes-e-concorrencia/` (`bilhetes.js`, `transferencias.js`, `otimista.js`, `isolamento.js`)

**Verificar:** `npm run verificar 38` (dentro de `pratica/`). Só um exercício: `npm run verificar 38 bilhetes`, `... 38 transferencias`, `... 38 otimista` ou `... 38 isolamento`. Precisa do Docker. Cada teste usa um *schema* novo, por isso não há restos de um teste para o seguinte.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O último bilhete (≈30 min)

**Ficheiro:** `bilhetes.js`

50 clientes, 10 bilhetes. A versão ingénua já lá está, para comparares. Escreve duas versões certas: uma com uma só instrução atómica, outra com `FOR UPDATE`. O último teste confirma que libertas as ligações ao pool.

**Sintaxe que vais praticar:** `pool.connect()`, `BEGIN`/`COMMIT`/`ROLLBACK`, `try/catch/finally` com `release()`, `UPDATE ... WHERE ... RETURNING`, `rowCount`, `SELECT ... FOR UPDATE`.

<details>
<summary>Pista</summary>

Escreve primeiro um ajudante `emTransacao(pool, fn)` que faz o `BEGIN`, chama `fn(cliente)`, faz o `COMMIT` (ou o `ROLLBACK`, se falhar) e liberta sempre o cliente. As duas compras ficam com quatro linhas cada.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · O último bilhete: uma condição de corrida clássica. Ver docs/38-transacoes-e-concorrencia.md.
//
// Tabelas: eventos (id, nome, disponiveis INT CHECK (disponiveis >= 0)) e compras (id, evento_id, cliente)
//
// A versão ingénua (já escrita, para comparares): lê, decide, escreve. Com pedidos em simultâneo, dois
// leem "1 disponível" ao mesmo tempo, e os dois compram. Corre os testes e vê-a falhar.
export async function comprarIngenuo(pool, eventoId, cliente) {
  const { rows } = await pool.query('SELECT disponiveis FROM eventos WHERE id = $1', [eventoId]);
  if (rows[0].disponiveis < 1) return false;
  await new Promise((r) => setTimeout(r, 5)); // o tempo de "fazer qualquer coisa" entre ler e escrever
  await pool.query('UPDATE eventos SET disponiveis = $1 WHERE id = $2', [rows[0].disponiveis - 1, eventoId]);
  await pool.query('INSERT INTO compras (evento_id, cliente) VALUES ($1, $2)', [eventoId, cliente]);
  return true;
}

// Um ajudante: corre fn(cliente) numa transação, com COMMIT no fim, ROLLBACK se falhar, e liberta
// SEMPRE o cliente (sem o release, cada chamada roubava uma ligação ao pool, até ele se esgotar).
async function emTransacao(pool, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

export async function comprarAtomico(pool, eventoId, cliente) {
  return emTransacao(pool, async (c) => {
    // Ler e decidir numa SÓ instrução: o Postgres bloqueia a linha durante o UPDATE, e o WHERE é
    // reavaliado depois de esperar pela transação anterior. Duas compras nunca veem o mesmo "1".
    const { rowCount } = await c.query(
      'UPDATE eventos SET disponiveis = disponiveis - 1 WHERE id = $1 AND disponiveis > 0 RETURNING disponiveis',
      [eventoId],
    );
    if (rowCount === 0) return false; // esgotado (o COMMIT de uma transação sem mudanças não faz mal)
    await c.query('INSERT INTO compras (evento_id, cliente) VALUES ($1, $2)', [eventoId, cliente]);
    return true;
  });
}

export async function comprarComBloqueio(pool, eventoId, cliente) {
  return emTransacao(pool, async (c) => {
    // FOR UPDATE: bloqueia a linha até ao fim da transação; as outras que a peçam ficam à espera.
    const { rows } = await c.query('SELECT disponiveis FROM eventos WHERE id = $1 FOR UPDATE', [eventoId]);
    if (rows[0].disponiveis < 1) return false;
    await c.query('UPDATE eventos SET disponiveis = disponiveis - 1 WHERE id = $1', [eventoId]);
    await c.query('INSERT INTO compras (evento_id, cliente) VALUES ($1, $2)', [eventoId, cliente]);
    return true;
  });
}
```
</details>

### P2 · Transferências sem deadlocks (≈25 min)

**Ficheiro:** `transferencias.js`

Uma transferência atómica, que recusa sem mexer em nada se não houver saldo, e 200 transferências cruzadas ao mesmo tempo (A→B e B→A) sem um único deadlock.

**Sintaxe que vais praticar:** `WHERE id = ANY($1)` com um array, `ORDER BY id FOR UPDATE`, `NUMERIC` (que o `pg` devolve como string: `Number(...)`), validação antes de abrir a transação.

<details>
<summary>Pista</summary>

Bloqueia as duas contas numa só consulta, com `ORDER BY id FOR UPDATE`: o Postgres bloqueia as linhas pela ordem em que as lê, por isso todas as transferências pedem os bloqueios pela mesma ordem, seja qual for o sentido.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function transferir(pool, de, para, valor) {
  if (de === para) throw new Error('não se transfere para a própria conta');
  if (!(valor > 0)) throw new Error('o valor tem de ser positivo');

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // As duas contas, bloqueadas SEMPRE pela mesma ordem (o id menor primeiro). Se a A→B bloqueasse
    // a A e a B→A bloqueasse a B, cada uma ficava à espera da outra para sempre: um deadlock.
    const { rows } = await cliente.query('SELECT id, saldo FROM contas WHERE id = ANY($1) ORDER BY id FOR UPDATE', [[de, para]]);
    const origem = rows.find((r) => r.id === de);
    if (!origem || !rows.some((r) => r.id === para)) throw new Error('conta inexistente');
    if (Number(origem.saldo) < valor) throw new Error('saldo insuficiente');
    await cliente.query('UPDATE contas SET saldo = saldo - $2 WHERE id = $1', [de, valor]);
    await cliente.query('UPDATE contas SET saldo = saldo + $2 WHERE id = $1', [para, valor]);
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}
```
</details>

### P3 · Bloqueio otimista (≈25 min)

**Ficheiro:** `otimista.js`

Atualizar só se a versão for a que leste, e uma operação que, num conflito, volta a ler e tenta outra vez. Dez edições ao mesmo tempo, e nenhuma se pode perder.

**Sintaxe que vais praticar:** uma classe de erro própria (`class Conflito extends Error`), `instanceof`, um ciclo de tentativas com `for (;;)` e `return`/`throw`.

<details>
<summary>Solução de referência</summary>

```js
export class Conflito extends Error {}

export async function atualizarTitulo(pool, id, titulo, versaoLida) {
  // A condição "versao = a que li" e a escrita são uma só instrução: ou ninguém mexeu, e escrevo;
  // ou alguém mexeu, e não escrevo nada.
  const { rows } = await pool.query(
    'UPDATE notas SET titulo = $2, versao = versao + 1 WHERE id = $1 AND versao = $3 RETURNING versao',
    [id, titulo, versaoLida],
  );
  if (rows.length === 0) throw new Conflito(`a nota ${id} mudou desde a versão ${versaoLida} (ou não existe)`);
  return rows[0].versao;
}

export async function acrescentarAoTitulo(pool, id, sufixo, { tentativas = 5 } = {}) {
  for (let n = 1; ; n++) {
    const { rows } = await pool.query('SELECT titulo, versao FROM notas WHERE id = $1', [id]);
    if (rows.length === 0) throw new Conflito(`a nota ${id} não existe`);
    const novo = rows[0].titulo + sufixo;
    try {
      await atualizarTitulo(pool, id, novo, rows[0].versao);
      return novo;
    } catch (e) {
      if (!(e instanceof Conflito) || n >= tentativas) throw e;
      // alguém mudou entretanto: volta a ler, e tenta com os dados novos
    }
  }
}
```
</details>

### P4 · Isolamento e serialização (≈35 min)

**Ficheiro:** `isolamento.js`

Ver com os teus olhos a diferença entre `READ COMMITTED` e `REPEATABLE READ`, um ajudante que repete as transações `SERIALIZABLE` canceladas com `40001`, e a regra do hospital, que sem ele falha.

**Sintaxe que vais praticar:** `BEGIN ISOLATION LEVEL ...`, `err.code` (os códigos SQLSTATE: `40001`, `40P01`, `23505`), uma lista de valores permitidos para o que não pode ser parâmetro, repetir uma transação inteira.

<details>
<summary>Pista</summary>

O `emSerializavel` usa o mesmo cliente para todas as tentativas, e cada tentativa é uma transação completa: `BEGIN ISOLATION LEVEL SERIALIZABLE`, `fn`, `COMMIT`. O erro `40001` pode aparecer em qualquer instrução, incluindo no próprio `COMMIT`, por isso o `try` tem de envolver tudo.
</details>

<details>
<summary>Solução de referência</summary>

```js
const NIVEIS = new Set(['READ COMMITTED', 'REPEATABLE READ']);

export async function contarDuasVezes(pool, nivel, entreAsDuas) {
  // O nível não pode ser um parâmetro ($1): vai colado no SQL, por isso só se aceitam os da lista.
  if (!NIVEIS.has(nivel)) throw new Error(`nível de isolamento não suportado: ${nivel}`);
  const cliente = await pool.connect();
  try {
    await cliente.query(`BEGIN ISOLATION LEVEL ${nivel}`);
    const contar = async () => (await cliente.query('SELECT count(*)::int AS n FROM tarefas')).rows[0].n;
    const primeira = await contar();
    await entreAsDuas();
    const segunda = await contar();
    await cliente.query('COMMIT');
    return [primeira, segunda];
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

export async function emSerializavel(pool, fn, { tentativas = 5 } = {}) {
  const cliente = await pool.connect();
  try {
    for (let n = 1; ; n++) {
      try {
        await cliente.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const resultado = await fn(cliente);
        await cliente.query('COMMIT'); // o erro 40001 também pode aparecer só aqui
        return resultado;
      } catch (e) {
        await cliente.query('ROLLBACK');
        // 40001: o Postgres detetou que esta transação, junto com outra, daria um resultado impossível
        // numa execução em série. A transação inteira repete-se do princípio.
        if (e.code !== '40001' || n >= tentativas) throw e;
      }
    }
  } finally {
    cliente.release();
  }
}

export async function sairDoTurno(pool, medico) {
  return emSerializavel(pool, async (c) => {
    const { rows } = await c.query('SELECT count(*)::int AS n FROM medicos WHERE de_turno');
    if (rows[0].n < 2) return false;
    await c.query('UPDATE medicos SET de_turno = false WHERE nome = $1', [medico]);
    return true;
  });
}
```
</details>

## Experiências

Com a stack do workshop a correr, abre dois terminais com o `psql` (`docker compose -f config/docker-compose.yml exec postgres psql -U workshop -d workshop`), lado a lado.

1. **Ver um bloqueio à espera:** no terminal 1, `BEGIN; SELECT * FROM tasks WHERE id = 1 FOR UPDATE;`. No terminal 2, `UPDATE tasks SET done = true WHERE id = 1;`: fica pendurado. Volta ao 1 e faz `COMMIT;`. O 2 desbloqueia na hora.
2. **Provocar um deadlock:** cada terminal faz `BEGIN;` e atualiza uma tarefa diferente (a 1 e a 2). Depois, cada um atualiza a do outro. Ao fim de um segundo, um deles recebe `ERROR: deadlock detected`. Lê a mensagem: o Postgres diz que processos e que linhas.
3. **Fotografias:** no terminal 1, `BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM tasks;`. No 2, cria uma tarefa no frontend. No 1, repete a contagem, faz `COMMIT;` e repete outra vez.
4. **Quem está à espera de quem:** durante a experiência 1, num terceiro terminal, corre `SELECT pid, state, wait_event_type, query FROM pg_stat_activity WHERE datname = 'workshop';`. É a primeira consulta a fazer quando a base de dados de produção "está lenta".

## Perguntas de pensamento crítico

1. O endpoint de "gostos" faz `SELECT likes`, soma 1 em JavaScript, e faz `UPDATE likes = $1`. Os números ficam abaixo do que deviam em dias de muito tráfego. Porquê, e qual é a correção mais simples?
2. Porque é que o bloqueio otimista é melhor do que o `FOR UPDATE` para um formulário de edição que o utilizador deixa aberto durante 10 minutos?
3. Um colega propõe pôr todas as transações em `SERIALIZABLE`, "para não haver problemas". O que lhe dizes?

<details>
<summary>Respostas</summary>

1. É uma corrida: dois pedidos leem 41, os dois escrevem 42, e um gosto perde-se. A correção mais simples é fazer a conta na base de dados, numa instrução atómica: `UPDATE posts SET likes = likes + 1 WHERE id = $1`. (Para contadores com um volume enorme, até isto vira um gargalo, porque todos esperam pela mesma linha; aí usam-se contadores no Redis com `INCR`, ou várias linhas somadas.)
2. Porque um `FOR UPDATE` mantém a linha bloqueada durante toda a transação, e uma transação aberta durante 10 minutos à espera de um humano bloquearia todos os outros que quisessem a mesma nota (e ocuparia uma ligação ao pool o tempo todo). Com versões, não se bloqueia nada enquanto o utilizador pensa; só no momento de gravar se verifica se alguém mudou entretanto, e, nesse caso raro, mostra-se o conflito.
3. Que não é grátis: em `SERIALIZABLE`, o Postgres tem mais trabalho a vigiar as leituras, e cancela transações com `40001` sempre que deteta um risco, por isso **todo** o código tem de saber repetir transações (e as que têm efeitos fora da BD, como enviar um email, não se podem repetir sem cuidado). Faz sentido para as operações com regras que atravessam várias linhas (como a do hospital); para a maior parte, uma instrução atómica, um `FOR UPDATE` ou uma restrição na tabela (`UNIQUE`, `CHECK`) resolvem o problema de forma mais simples e mais barata.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 38`.

**1.** Porque é que 'SELECT stock; if (stock > 0) UPDATE stock = stock_lido - 1' vende a mais com pedidos em simultâneo?

- a) Porque o SQL é lento
- b) Porque dois pedidos podem ler o mesmo valor antes de qualquer um escrever (uma condição de corrida)
- c) Porque falta um índice
- d) Porque o Node é single-threaded

<details><summary>Resposta</summary>

**b) Porque dois pedidos podem ler o mesmo valor antes de qualquer um escrever (uma condição de corrida)** — A correção mais simples: UPDATE ... SET stock = stock - 1 WHERE id = $1 AND stock > 0, numa só instrução.

</details>

**2.** Como se evitam deadlocks entre transferências A→B e B→A?

- a) Com um timeout maior
- b) Bloqueando as contas sempre pela mesma ordem (ex.: o id menor primeiro)
- c) Desligando as transações
- d) Usando READ UNCOMMITTED

<details><summary>Resposta</summary>

**b) Bloqueando as contas sempre pela mesma ordem (ex.: o id menor primeiro)** — Se todas pedem os bloqueios pela mesma ordem, nenhuma pode ficar com B à espera de A enquanto outra tem A à espera de B.

</details>

**3.** Que código SQLSTATE indica que o Postgres cancelou uma transação SERIALIZABLE e que ela deve ser repetida?

<details><summary>Resposta</summary>

**40001** — Não é um bug: é o Postgres a dizer 'tenta outra vez'. O 40P01 é um deadlock.

</details>

**4.** No pg (Node), porque é que uma transação não pode usar pool.query em cada instrução?

- a) Porque o pool.query é mais lento
- b) Porque cada pool.query pode usar uma ligação diferente, e uma transação vive numa só ligação
- c) Porque o pool não aceita BEGIN
- d) Porque o pool só faz SELECT

<details><summary>Resposta</summary>

**b) Porque cada pool.query pode usar uma ligação diferente, e uma transação vive numa só ligação** — Pede-se um cliente com pool.connect(), usa-se em todas as instruções, e liberta-se sempre no finally.

</details>

**5.** Que anomalia o SERIALIZABLE apanha e o REPEATABLE READ não, como dois médicos a sair do turno ao mesmo tempo?

- a) Dirty read
- b) Write skew: cada transação lê o mesmo estado e escreve em linhas diferentes, quebrando uma regra que envolve as duas
- c) Deadlock
- d) Phantom delete

<details><summary>Resposta</summary>

**b) Write skew: cada transação lê o mesmo estado e escreve em linhas diferentes, quebrando uma regra que envolve as duas** — Como não escrevem na mesma linha, nenhum bloqueio as impede; só a deteção de dependências do SERIALIZABLE.

</details>

<!-- quiz:end -->
