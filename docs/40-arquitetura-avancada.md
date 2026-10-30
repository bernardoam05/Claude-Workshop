# 40 · Arquitetura avançada: DDD, hexagonal, CQRS, event sourcing e sagas

**Objetivo:** conhecer os padrões de arquitetura que aparecem em sistemas grandes, e sobretudo saber **quando não os usar**: Domain-Driven Design (linguagem ubíqua, contextos delimitados, agregados, objetos de valor, eventos de domínio), arquitetura hexagonal (portas e adaptadores), CQRS, event sourcing, e sagas para operações que atravessam vários serviços.

**Ficheiros para ler:** `src/api/src/index.js` (o ponto de composição, onde as peças se ligam), `src/api/src/services/` e `src/api/src/repositories/` (as camadas do módulo 04), e `src/activity/` (um serviço que só lê eventos).

**Pré-requisitos:** módulos 04 (camadas e injeção de dependências), 06 e 17 (eventos), 13 (trade-offs) e 38 (concorrência).

---

## 1. Porque é que a arquitetura em camadas deixa de chegar

O módulo 04 organizou a API em camadas: rotas, serviços, repositórios. Para um CRUD de tarefas, chega e sobra. Num sistema com regras de negócio a sério (uma loja, um banco, um hospital), aparecem problemas que as camadas, por si, não resolvem:

- as regras ficam espalhadas por serviços com centenas de linhas, e ninguém sabe onde está a regra "uma encomenda confirmada já não pode ter linhas novas";
- a mesma palavra quer dizer coisas diferentes em equipas diferentes ("cliente" para as vendas é quem compra, para o apoio é quem abriu um pedido);
- o modelo que serve para escrever (com todas as validações) é péssimo para as leituras dos ecrãs e dos relatórios;
- uma operação atravessa três serviços, e não há uma transação que os junte.

Os padrões deste módulo respondem a cada um. Nenhum é obrigatório, e todos têm um custo: aplicados a um problema simples, tornam-no complicado. O módulo 13 já o dizia; aqui vês o que se ganha e o que se paga.

## 2. Domain-Driven Design: a parte estratégica

O **DDD** (o livro do Eric Evans, de 2003) começa por pessoas, não por código:

- **Linguagem ubíqua:** a equipa (programadores e especialistas do negócio) usa as **mesmas palavras** nas conversas, nos documentos e no código. Se o negócio diz "encomenda confirmada", a classe chama-se `Encomenda` e o método `confirmar()`, e não `Order.setStatus(2)`. Uma tradução a menos é um mal-entendido a menos.
- **Contextos delimitados** (*bounded contexts*): um sistema grande divide-se em contextos, cada um com o seu modelo e a sua linguagem. "Produto" no catálogo tem descrições e fotografias; no armazém tem dimensões e uma prateleira; na faturação tem uma taxa de IVA. Em vez de um `Produto` gigante partilhado por todos, cada contexto tem o seu, e comunicam por eventos ou APIs. Os contextos são a forma natural de cortar um monólito em microserviços (ou em módulos de um monólito bem organizado).
- **Mapa de contextos:** como os contextos se relacionam (quem depende de quem, quem traduz o modelo de quem, com uma *anti-corruption layer* à entrada para o modelo de um sistema antigo não contaminar o novo).

Neste projeto, a API de tarefas, o `activity` (Java) e o `notifications` (.NET) já são três contextos, cada um com o seu modelo do que é uma "tarefa", ligados por eventos.

## 3. DDD tático: entidades, objetos de valor e agregados

| Peça | O que é | Exemplo |
|---|---|---|
| **Entidade** | tem identidade, que se mantém quando os dados mudam | uma `Encomenda` (a E1 continua a ser a E1, mesmo com outras linhas) |
| **Objeto de valor** | sem identidade, definido pelos valores; **imutável** | `Dinheiro(1234, 'EUR')`, uma morada, um intervalo de datas |
| **Agregado** | um grupo de objetos tratados como uma unidade, com uma **raiz** por onde passa toda a mudança | a `Encomenda` e as suas linhas |
| **Evento de domínio** | algo que aconteceu e que interessa a outros | `EncomendaConfirmada` |
| **Repositório** | guarda e lê agregados inteiros | `repositorio.guardar(encomenda)` |

Os **objetos de valor** resolvem bugs reais: `Dinheiro` guarda cêntimos inteiros (adeus `0.1 + 0.2 = 0.30000000000000004`), recusa somar euros com dólares, e não pode ser alterado por engano por quem o recebe.

O **agregado** é a peça central. As regras do negócio (as **invariantes**) vivem nos seus métodos, e a única forma de o mudar é através deles:

```js
encomenda.adicionarLinha('pao', 2, new Dinheiro(120));   // valida: em rascunho? quantidade > 0? máximo 10?
encomenda.confirmar();                                   // valida e regista o evento EncomendaConfirmada
encomenda.linhas.push(...)                               // não muda nada: devolve uma cópia
```

Compara com um serviço que faz `UPDATE encomendas SET estado = 'confirmada'` diretamente: a regra "não se confirma uma encomenda vazia" teria de estar repetida em todos os sítios que mudam o estado. Regras do agregado:

- uma transação muda **um** agregado (a fronteira do agregado é a fronteira da consistência imediata);
- os agregados referem-se uns aos outros **pelo id**, não por objetos;
- mantém-nos **pequenos**: um agregado gigante é um bloqueio gigante (módulo 38).

## 4. Arquitetura hexagonal: portas e adaptadores

A ideia (do Alistair Cockburn, também chamada *ports and adapters*, e muito parecida com a *clean architecture*): o núcleo da aplicação (o domínio e os casos de uso) não depende de nada de infraestrutura. Define **portas** (interfaces: "preciso de algo que guarde tarefas", "preciso de algo que envie emails"), e o mundo exterior liga-se a elas por **adaptadores**:

```
          adaptadores de entrada                       adaptadores de saída
   HTTP (Express) ──┐                              ┌── Postgres (pg)
   fila (RabbitMQ) ─┼──▶ [ casos de uso + domínio ] ◀┼── SMTP / SES
   CLI, testes ─────┘        (portas)               └── memória (testes)
```

As dependências apontam **para dentro**: o núcleo não importa o `pg`, o `express` nem o `nodemailer`. Recebe as portas por parâmetro (injeção de dependências, módulo 04). O que se ganha:

- **testes rápidos e sem infraestrutura:** o caso de uso testa-se com adaptadores em memória (o P3);
- **trocar peças:** passar do SMTP para o Amazon SES, ou do Postgres para outro sítio, é escrever um adaptador novo, sem tocar nas regras;
- **as regras não se misturam com detalhes:** o código que decide "um email por pessoa, com as tarefas por ordem de prazo" não tem SQL nem cabeçalhos HTTP pelo meio.

O `src/api/src/index.js` deste projeto já é o "ponto de composição" de uma arquitetura assim: é o único sítio que sabe que peças concretas são usadas, e liga-as.

## 5. CQRS: separar escrever de ler

**CQRS** (*Command Query Responsibility Segregation*): o modelo que serve para **mudar** dados não tem de ser o mesmo que serve para os **ler**.

- O lado dos **comandos** usa os agregados, com todas as regras, e otimiza-se para consistência.
- O lado das **consultas** usa modelos de leitura (*read models*, ou projeções) pensados para cada ecrã: tabelas desnormalizadas, uma vista materializada, um índice no Elasticsearch, uma chave no Redis. Sem regras, só dados prontos a mostrar.

Os modelos de leitura atualizam-se a partir dos **eventos** do lado da escrita, por isso ficam com **consistência eventual**: um instante depois. O `src/activity` deste projeto é um exemplo pequeno de CQRS: consome os eventos de tarefas (módulo 17) e mantém o seu próprio modelo, pensado para as consultas de atividade.

CQRS compensa quando as leituras e as escritas são muito diferentes (em forma ou em volume). Para um CRUD, é complexidade a mais.

## 6. Event sourcing

Num sistema normal, guarda-se o **estado atual** (o saldo é 70). No **event sourcing**, guarda-se a **sequência de eventos** que aconteceu (aberta, depositou 100, levantou 30), e o estado é **calculado** a partir deles:

```js
const estado = eventos.reduce(aplicar, null);     // { titular: 'Ana', saldo: 70, aberta: true }
```

Um comando passa a ser três passos: ler os eventos do *stream* (um por agregado), reconstruir o estado, decidir que eventos novos acontecem, e acrescentá-los. A concorrência resolve-se com o bloqueio otimista do módulo 38: grava-se "com a versão que li", e se outro gravou entretanto, falha.

O que se ganha: um **histórico completo e auditável** (ninguém apaga nem altera um evento: um erro corrige-se com um evento novo), a possibilidade de **reconstruir** o estado num momento passado ("qual era o saldo a 1 de março?"), e de criar **projeções novas** a qualquer momento, reprocessando os eventos desde o início. É natural em domínios que já pensam assim: contabilidade, bancos, logística.

O que se paga, e é muito: os eventos são para sempre, por isso mudar a sua forma exige versões e "upcasters"; reconstruir agregados com milhares de eventos exige *snapshots*; as consultas vão sempre às projeções (CQRS vem quase sempre junto); e a equipa tem de aprender uma forma diferente de pensar. Usa-se num contexto que precise mesmo dele, nunca no sistema inteiro "por arquitetura".

## 7. Sagas: transações que atravessam serviços

Uma encomenda reserva stock (serviço de armazém), cobra (serviço de pagamentos) e agenda a entrega (serviço de logística). São três bases de dados diferentes: não há um `BEGIN`/`COMMIT` que as junte. Se a entrega falhar, o cliente já foi cobrado.

Uma **saga** é uma sequência de passos locais, cada um com uma **compensação**: a ação que desfaz o seu efeito (reembolsar desfaz cobrar; libertar desfaz reservar). Se um passo falha, executam-se as compensações dos passos anteriores, pela ordem inversa:

```
reservar ✓ → cobrar ✓ → entregar ✗  ⇒  reembolsar → libertar
```

Notas importantes:

- Uma compensação **não é um rollback**: o cliente pode ter visto a cobrança no extrato. É uma nova ação de negócio, e às vezes não existe (não se "desenvia" um email: envia-se outro a pedir desculpa).
- As compensações também podem falhar, e têm de ser **repetidas** até resultarem (idempotentes, módulo 06), ou ir para uma fila de intervenção humana.
- **Orquestração** (um coordenador diz a cada serviço o que fazer, como o P4) é mais fácil de seguir e de depurar. **Coreografia** (cada serviço reage aos eventos dos outros, sem coordenador) é mais desacoplada, mas o fluxo fica espalhado e difícil de ver. Ferramentas como o Temporal ou o AWS Step Functions ajudam a orquestrar sagas longas, com estado persistente e repetições.

E o problema que a saga não resolve sozinha: gravar na BD **e** publicar o evento de forma atómica. É o *outbox* do módulo 06 (P3), que as sagas usam em cada passo.

## 8. Quando usar o quê

| Padrão | Usar quando | Não usar quando |
|---|---|---|
| DDD estratégico (linguagem, contextos) | quase sempre: é barato e evita mal-entendidos | (é raro ser má ideia) |
| Agregados e objetos de valor | o domínio tem regras que se repetem e se partem | é um CRUD sem regras |
| Hexagonal | a lógica de negócio é o valor do sistema e vive muitos anos | scripts, protótipos, serviços de 200 linhas |
| CQRS | leituras e escritas muito diferentes, em forma ou em volume | as leituras são o mesmo que se escreve |
| Event sourcing | o histórico **é** o negócio (contabilidade, auditoria obrigatória) | "para ter histórico": uma tabela de auditoria chega |
| Sagas | uma operação atravessa serviços com bases de dados próprias | dá para fazer numa só base de dados, com uma transação |

## Em resumo

- Quando o domínio é rico, a arquitetura em camadas deixa de chegar: a lógica espalha-se pelos serviços e as regras perdem-se.
- O **DDD estratégico** divide o sistema em **contextos delimitados**, cada um com a sua linguagem ubíqua.
- O **DDD tático** modela com **entidades** (com identidade), **objetos de valor** (definidos pelo valor) e **agregados** (fronteiras de consistência com uma raiz).
- A **arquitetura hexagonal** põe o domínio no centro e liga-o ao mundo por **portas** (interfaces) e **adaptadores** (BD, HTTP, filas).
- O **CQRS** separa o modelo de escrita do de leitura; o ***event sourcing*** guarda os eventos como a fonte da verdade e reconstrói o estado a partir deles.
- As **sagas** coordenam transações que atravessam serviços, com ações de **compensação** quando um passo falha.
- Cada padrão tem um custo: usa-se onde a complexidade do domínio o justifica, não por omissão.

---

## Prática: escreve tu

As peças do módulo, em código puro (sem bases de dados nem frameworks, para se ver a ideia): um objeto de valor e um agregado com invariantes, uma conta com event sourcing (com o armazém de eventos e uma projeção de leitura), um caso de uso hexagonal testado com adaptadores em memória, e uma saga orquestrada com compensações.

**Ficheiros:** `pratica/40-arquitetura-avancada/` (`dominio.js`, `eventos.js`, `hexagonal.js`, `saga.js`)

**Verificar:** `npm run verificar 40` (dentro de `pratica/`). Só um exercício: `npm run verificar 40 dominio`, `... 40 eventos`, `... 40 hexagonal` ou `... 40 saga`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Um objeto de valor e um agregado (≈35 min)

**Ficheiro:** `dominio.js`

`Dinheiro` (imutável, em cêntimos, comparado por valor) e uma `Encomenda` que protege as suas regras: só se mexe em rascunho, quantidades válidas, no máximo 10 produtos, não se confirma vazia, e regista eventos de domínio. Os testes tentam mexer nas linhas por fora: não pode resultar.

**Sintaxe que vais praticar:** `Object.freeze`, campos privados (`#linhas`), *getters*, devolver cópias (`map((l) => ({ ...l }))`), `reduce` com um objeto de valor, `splice(0)`.

<details>
<summary>Pista</summary>

Com campos privados (`#linhas`, `#eventos`), ninguém fora da classe consegue chegar à lista verdadeira. O *getter* `linhas` devolve cópias de cada linha, por isso até mudar a quantidade de uma linha devolvida não afeta a encomenda.
</details>

<details>
<summary>Solução de referência</summary>

```js
export class Dinheiro {
  constructor(centimos, moeda = 'EUR') {
    // Dinheiro em cêntimos inteiros: com números de vírgula, 0.1 + 0.2 = 0.30000000000000004.
    if (!Number.isInteger(centimos)) throw new Error(`cêntimos têm de ser inteiros: ${centimos}`);
    this.centimos = centimos;
    this.moeda = moeda;
    Object.freeze(this);
  }

  somar(outro) {
    if (outro.moeda !== this.moeda) throw new Error(`não se somam ${this.moeda} com ${outro.moeda}`);
    return new Dinheiro(this.centimos + outro.centimos, this.moeda);
  }

  multiplicar(n) {
    if (!Number.isInteger(n)) throw new Error('multiplica-se por um inteiro (uma quantidade)');
    return new Dinheiro(this.centimos * n, this.moeda);
  }

  igual(outro) {
    return this.centimos === outro.centimos && this.moeda === outro.moeda;
  }

  toString() {
    return `${(this.centimos / 100).toFixed(2)} ${this.moeda}`;
  }
}

const MAX_LINHAS = 10;

export class Encomenda {
  // Campos privados (#): a única forma de os mudar é pelos métodos, que protegem as regras.
  #linhas = [];
  #eventos = [];

  constructor(id, clienteId) {
    this.id = id;
    this.clienteId = clienteId;
    this.estado = 'rascunho';
  }

  adicionarLinha(produtoId, quantidade, precoUnitario) {
    if (this.estado !== 'rascunho') throw new Error('só se acrescentam linhas a uma encomenda em rascunho');
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error('a quantidade tem de ser um inteiro positivo');
    const existente = this.#linhas.find((l) => l.produtoId === produtoId);
    if (existente) {
      existente.quantidade += quantidade;
      return;
    }
    if (this.#linhas.length >= MAX_LINHAS) throw new Error(`no máximo ${MAX_LINHAS} produtos por encomenda`);
    this.#linhas.push({ produtoId, quantidade, precoUnitario });
  }

  get linhas() {
    return this.#linhas.map((l) => ({ ...l })); // cópias: mexer nelas não mexe na encomenda
  }

  get total() {
    return this.#linhas.reduce((t, l) => t.somar(l.precoUnitario.multiplicar(l.quantidade)), new Dinheiro(0));
  }

  confirmar() {
    if (this.estado !== 'rascunho') throw new Error('só se confirma uma encomenda em rascunho');
    if (this.#linhas.length === 0) throw new Error('não se confirma uma encomenda vazia');
    this.estado = 'confirmada';
    this.#eventos.push({ tipo: 'EncomendaConfirmada', encomendaId: this.id, clienteId: this.clienteId, total: this.total.toString() });
  }

  cancelar() {
    if (!['rascunho', 'confirmada'].includes(this.estado)) throw new Error(`não se cancela uma encomenda ${this.estado}`);
    this.estado = 'cancelada';
    this.#eventos.push({ tipo: 'EncomendaCancelada', encomendaId: this.id });
  }

  retirarEventos() {
    return this.#eventos.splice(0);
  }
}
```
</details>

### P2 · Event sourcing e uma projeção (≈45 min)

**Ficheiro:** `eventos.js`

O estado como uma redução de eventos, comandos que decidem sem mudar nada, um armazém que só acrescenta (com bloqueio otimista por versão), o ciclo "ler, decidir, gravar", e uma projeção de leitura com o saldo de cada titular.

**Sintaxe que vais praticar:** `reduce` com uma função pura, `switch` sobre o tipo do evento, espalhar objetos (`{ ...estado, saldo }`), `Map`, *callbacks* de subscrição, *rest parameters* (`...args`), métodos privados (`#tratar`).

<details>
<summary>Pista</summary>

O `executar` é a peça que junta tudo: `ler` → `reconstruir` → `comando(estado, ...args)` → `acrescentar(contaId, novos, historia.length)`. A versão esperada é o tamanho da história que leste. Se o comando lançar um erro, nada chega a ser gravado: é por isso que decidir e gravar são passos separados.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function aplicar(estado, evento) {
  switch (evento.tipo) {
    case 'ContaAberta':
      return { contaId: evento.contaId, titular: evento.titular, saldo: 0, aberta: true };
    case 'Depositado':
      return { ...estado, saldo: estado.saldo + evento.valor };
    case 'Levantado':
      return { ...estado, saldo: estado.saldo - evento.valor };
    case 'ContaFechada':
      return { ...estado, aberta: false };
    default:
      throw new Error(`evento desconhecido: ${evento.tipo}`);
  }
}

export function reconstruir(eventos) {
  return eventos.reduce(aplicar, null);
}

const exigirAberta = (estado) => {
  if (!estado?.aberta) throw new Error('a conta não está aberta');
};
const exigirPositivo = (valor) => {
  if (!(valor > 0)) throw new Error('o valor tem de ser positivo');
};

export function abrir(estado, contaId, titular) {
  if (estado !== null) throw new Error('a conta já existe');
  return [{ tipo: 'ContaAberta', contaId, titular }];
}

export function depositar(estado, valor) {
  exigirAberta(estado);
  exigirPositivo(valor);
  return [{ tipo: 'Depositado', contaId: estado.contaId, valor }];
}

export function levantar(estado, valor) {
  exigirAberta(estado);
  exigirPositivo(valor);
  if (valor > estado.saldo) throw new Error(`saldo insuficiente (${estado.saldo})`);
  return [{ tipo: 'Levantado', contaId: estado.contaId, valor }];
}

export function fechar(estado) {
  exigirAberta(estado);
  if (estado.saldo !== 0) throw new Error('só se fecha uma conta com saldo 0');
  return [{ tipo: 'ContaFechada', contaId: estado.contaId }];
}

export class ArmazemDeEventos {
  constructor() {
    this.streams = new Map();
    this.ordem = [];
    this.subscritores = [];
  }

  acrescentar(streamId, eventos, versaoEsperada) {
    const stream = this.streams.get(streamId) ?? [];
    if (stream.length !== versaoEsperada) {
      throw new Error(`concorrência: o stream ${streamId} está na versão ${stream.length}, esperava ${versaoEsperada}`);
    }
    for (const e of eventos) {
      const guardado = { ...e, versao: stream.length + 1 };
      stream.push(guardado);
      this.ordem.push(guardado);
      for (const fn of this.subscritores) fn(guardado);
    }
    this.streams.set(streamId, stream);
  }

  ler(streamId) {
    return [...(this.streams.get(streamId) ?? [])];
  }

  todos() {
    return [...this.ordem];
  }

  subscrever(fn) {
    this.subscritores.push(fn);
  }
}

export function executar(armazem, contaId, comando, ...args) {
  const historia = armazem.ler(contaId);
  const estado = reconstruir(historia);
  const novos = comando(estado, ...args); // decide (ou lança): ainda nada foi gravado
  armazem.acrescentar(contaId, novos, historia.length);
  return novos.reduce(aplicar, estado);
}

export class ProjecaoSaldos {
  constructor(armazem) {
    this.titularDaConta = new Map();
    this.saldoDaConta = new Map();
    for (const e of armazem.todos()) this.#tratar(e);
    armazem.subscrever((e) => this.#tratar(e));
  }

  #tratar(e) {
    if (e.tipo === 'ContaAberta') {
      this.titularDaConta.set(e.contaId, e.titular);
      this.saldoDaConta.set(e.contaId, 0);
    } else if (e.tipo === 'Depositado') {
      this.saldoDaConta.set(e.contaId, this.saldoDaConta.get(e.contaId) + e.valor);
    } else if (e.tipo === 'Levantado') {
      this.saldoDaConta.set(e.contaId, this.saldoDaConta.get(e.contaId) - e.valor);
    } else if (e.tipo === 'ContaFechada') {
      this.saldoDaConta.delete(e.contaId);
    }
  }

  saldoDe(titular) {
    let total = 0;
    for (const [conta, saldo] of this.saldoDaConta) if (this.titularDaConta.get(conta) === titular) total += saldo;
    return total;
  }
}
```
</details>

### P3 · Um caso de uso hexagonal (≈25 min)

**Ficheiro:** `hexagonal.js`

Os lembretes de tarefas atrasadas: um caso de uso que recebe as suas portas (repositório, enviador, relógio) por parâmetro e não importa nada. Os testes ligam-lhe adaptadores em memória, incluindo um enviador que falha para uma pessoa. Escreves também um adaptador para desenvolvimento.

**Sintaxe que vais praticar:** injeção de dependências por parâmetro, `Map` para agrupar, `sort` por datas, `try/catch` com `continue`, `toISOString().slice(0, 10)`.

<details>
<summary>Solução de referência</summary>

```js
const dia = (data) => data.toISOString().slice(0, 10);

export function criarLembretes({ repositorio, enviador, relogio }) {
  return {
    async executar() {
      const atrasadas = await repositorio.tarefasAtrasadas(relogio.agora());

      const porDono = new Map();
      for (const t of atrasadas) {
        if (!porDono.has(t.dono.email)) porDono.set(t.dono.email, []);
        porDono.get(t.dono.email).push(t);
      }

      let enviados = 0;
      let falhados = 0;
      for (const [email, tarefas] of porDono) {
        tarefas.sort((a, b) => a.prazo - b.prazo);
        const n = tarefas.length;
        try {
          await enviador.enviar({
            para: email,
            assunto: `Tens ${n} ${n === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`,
            texto: tarefas.map((t) => `- ${t.titulo} (desde ${dia(t.prazo)})`).join('\n'),
          });
        } catch {
          falhados++; // as tarefas desta pessoa ficam por marcar: voltam a ser lembradas da próxima vez
          continue;
        }
        for (const t of tarefas) await repositorio.marcarLembrada(t.id);
        enviados++;
      }
      return { enviados, falhados };
    },
  };
}

export function criarEnviadorEmMemoria({ registar = false } = {}) {
  const enviados = [];
  return {
    enviados,
    async enviar(email) {
      enviados.push(email);
      if (registar) console.log(`[email] para ${email.para}: ${email.assunto}\n${email.texto}`);
    },
  };
}
```
</details>

### P4 · Uma saga com compensações (≈25 min)

**Ficheiro:** `saga.js`

Reservar, cobrar, entregar: se um passo falhar, compensam-se os anteriores pela ordem inversa; se uma compensação falhar, regista-se e continua-se.

**Sintaxe que vais praticar:** `for...of` com `await`, `try/catch` encaixados, `reverse()`, um registo de acontecimentos.

<details>
<summary>Solução de referência</summary>

```js
export async function executarSaga(passos, contexto = {}) {
  const registo = [];
  const feitos = [];
  for (const passo of passos) {
    try {
      await passo.executar(contexto);
      feitos.push(passo);
      registo.push(`ok: ${passo.nome}`);
    } catch (e) {
      registo.push(`falhou: ${passo.nome}: ${e.message}`);
      // Desfazer o que já aconteceu, do mais recente para o mais antigo.
      for (const feito of feitos.reverse()) {
        try {
          await feito.compensar(contexto);
          registo.push(`compensado: ${feito.nome}`);
        } catch (erroComp) {
          // Não se pode parar a meio: regista-se (alguém, ou um processo, terá de tratar disto) e continua-se.
          registo.push(`compensação falhou: ${feito.nome}: ${erroComp.message}`);
        }
      }
      return { sucesso: false, registo };
    }
  }
  return { sucesso: true, registo };
}
```
</details>

## Experiências

1. **A linguagem ubíqua neste projeto:** lista as palavras de domínio que o código da API usa (`task`, `done`, `user`...) e as que o frontend mostra. Batem certo? Onde há uma tradução, há um sítio onde se pode perder o significado.
2. **Um evento novo:** no P2, acrescenta um evento `Bloqueada` (a conta não aceita levantamentos, mas aceita depósitos). Quantos sítios tens de mudar? E o que acontece aos streams antigos, que nunca tiveram esse evento?
3. **Uma projeção nova, depois do facto:** no P2, escreve uma `ProjecaoMovimentos` que conta os depósitos de cada titular. Cria-a **depois** de haver eventos: como lê os eventos antigos, já está completa. Num sistema com estado atual em vez de eventos, como responderias a "quantos depósitos fez a Ana em março"?
4. **Coreografia em vez de orquestração:** reescreve a saga do P4 sem o `executarSaga`: cada passo publica um evento (`StockReservado`, `PagamentoFeito`...) num `EventEmitter`, e o passo seguinte reage. Onde ficou o conhecimento de "que passos existem e por que ordem"? E quem decide compensar?

## Perguntas de pensamento crítico

1. Uma equipa de três pessoas vai fazer um backoffice para gerir as reservas de um restaurante. Alguém propõe DDD tático, event sourcing e CQRS desde o primeiro dia. Que lhe dizes?
2. Porque é que um agregado deve ser pequeno?
3. Qual é a diferença entre um rollback numa transação e uma compensação numa saga?

<details>
<summary>Respostas</summary>

1. Que os padrões resolvem problemas que eles provavelmente não têm: um backoffice de reservas é, em grande parte, um CRUD com algumas regras (não sobrepor reservas, limites de lotação). As camadas do módulo 04, com as regras bem arrumadas num serviço (ou num agregado simples) e uma restrição na base de dados para as sobreposições, chegam. Event sourcing e CQRS trariam projeções, versões de eventos, consistência eventual e uma curva de aprendizagem para a equipa toda, sem um benefício que se veja. Do DDD, aproveitaria a parte barata: a linguagem do restaurante no código.
2. Porque o agregado é a unidade de consistência e de bloqueio: uma transação muda um agregado inteiro, e duas pessoas a mexer no mesmo agregado ao mesmo tempo esperam uma pela outra (ou entram em conflito, com bloqueio otimista). Um agregado gigante ("o restaurante, com todas as reservas e mesas") faria de cada mudança um conflito com todas as outras, e carregá-lo seria lento. Agregados pequenos ("uma reserva") permitem muitas mudanças em paralelo; as regras entre agregados tratam-se com eventos e consistência eventual.
3. Um rollback desfaz o que ainda não foi confirmado: para o resto do mundo, é como se nunca tivesse acontecido. Uma compensação é uma ação **nova**, depois de o passo original já ter sido confirmado e possivelmente visto por outros (o cliente viu a cobrança). Tem regras de negócio próprias, pode falhar e tem de ser repetida, e nem sempre desfaz tudo (um email enviado não se desenvia). Por isso, ao desenhar uma saga, cada passo precisa de uma compensação pensada com o negócio, e não só técnica.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 40`.

**1.** Qual é a diferença entre uma entidade e um objeto de valor, em DDD?

- a) Nenhuma
- b) A entidade tem identidade que se mantém quando os dados mudam; o objeto de valor é definido pelos valores e é imutável
- c) O objeto de valor vai para a BD e a entidade não
- d) A entidade é sempre maior

<details><summary>Resposta</summary>

**b) A entidade tem identidade que se mantém quando os dados mudam; o objeto de valor é definido pelos valores e é imutável** — Dinheiro(1234, 'EUR') é um objeto de valor; a encomenda E1 continua a ser a E1 com outras linhas.

</details>

**2.** Na arquitetura hexagonal, para onde apontam as dependências?

- a) Do domínio para a base de dados
- b) Para dentro: o núcleo define portas e não importa infraestrutura; os adaptadores dependem do núcleo
- c) Para fora, para o HTTP
- d) Não há dependências

<details><summary>Resposta</summary>

**b) Para dentro: o núcleo define portas e não importa infraestrutura; os adaptadores dependem do núcleo** — É o que permite testar os casos de uso com adaptadores em memória e trocar o SMTP ou o Postgres sem tocar nas regras.

</details>

**3.** Que padrão separa o modelo que muda os dados do modelo que os lê (sigla)?

<details><summary>Resposta</summary>

**cqrs** — Command Query Responsibility Segregation: os modelos de leitura atualizam-se a partir dos eventos, com consistência eventual.

</details>

**4.** No event sourcing, o que se guarda?

- a) Só o estado atual
- b) A sequência de eventos que aconteceu; o estado calcula-se aplicando-os
- c) Um backup diário
- d) Os logs da aplicação

<details><summary>Resposta</summary>

**b) A sequência de eventos que aconteceu; o estado calcula-se aplicando-os** — Histórico completo e auditável, projeções novas a qualquer momento; em troca, versões de eventos, snapshots e mais complexidade.

</details>

**5.** Numa saga, o que acontece quando um passo falha?

- a) A base de dados faz rollback de tudo
- b) Executam-se as compensações dos passos anteriores, pela ordem inversa
- c) Repete-se a saga para sempre
- d) Ignora-se o passo

<details><summary>Resposta</summary>

**b) Executam-se as compensações dos passos anteriores, pela ordem inversa** — Uma compensação é uma ação de negócio nova (reembolsar, libertar), não um rollback; também pode falhar e tem de ser repetida.

</details>

<!-- quiz:end -->
