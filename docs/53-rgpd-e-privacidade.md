# 53 · RGPD e privacidade para quem programa

**Objetivo:** perceber o que o Regulamento Geral sobre a Proteção de Dados (RGPD) exige de quem escreve software, e como isso se traduz em código: minimização, pseudonimização, logs sem dados pessoais, consentimento que se consegue provar, os direitos de acesso e de apagamento, e prazos de conservação. Isto não é aconselhamento jurídico: é o que um programador precisa de saber para fazer as perguntas certas e não criar problemas.

**Ficheiros para ler:** `src/api/src/routes/auth.js` (que dados pessoais o workshop guarda) e a configuração dos logs (módulo 19).

**Pré-requisitos:** módulos 03 (Postgres), 13 (segurança) e 26 (OWASP).

---

## 1. Porque é que isto é contigo

O RGPD (Regulamento (UE) 2016/679, aplicável desde 2018) aplica-se a qualquer organização que trate dados pessoais de pessoas na UE. As coimas podem chegar a 4% da faturação mundial, mas o mais comum na vida de uma equipa é mais prosaico: um cliente empresarial que exige um questionário de segurança e privacidade antes de assinar, um pedido de um utilizador para apagar a conta, uma auditoria. E a lei pede **proteção de dados desde a conceção e por omissão** (art. 25.º): as decisões que contam são tomadas por quem desenha as tabelas, os logs e as APIs, muito antes de um jurista ver o sistema.

## 2. Os conceitos que tens de conhecer

- **Dado pessoal:** qualquer informação sobre uma pessoa identificada **ou identificável**. Nome e email, claro; mas também um IP, um id de dispositivo, uma localização, um id interno que se possa ligar à pessoa. A pergunta é "dá para chegar à pessoa, com meios razoáveis?".
- **Categorias especiais** (art. 9.º): saúde, origem racial ou étnica, opiniões políticas, religião, orientação sexual, dados biométricos e genéticos. Regras muito mais apertadas.
- **Titular:** a pessoa a quem os dados dizem respeito.
- **Responsável pelo tratamento:** quem decide para que servem os dados (a tua empresa, em relação aos clientes dela). **Subcontratante:** quem trata por conta de outro (o fornecedor de cloud, o serviço de email). Entre os dois tem de haver um contrato (o DPA, *data processing agreement*).
- **Tratamento:** qualquer operação sobre dados pessoais: recolher, guardar, consultar, transmitir, apagar.

## 3. Os princípios, traduzidos para código

O art. 5.º lista os princípios. Em termos práticos:

| Princípio | No código |
|---|---|
| **Licitude, lealdade, transparência** | cada tratamento tem uma base legal (secção 4) e está explicado na política de privacidade |
| **Limitação das finalidades** | dados recolhidos para entregar encomendas não servem, sem mais, para publicidade |
| **Minimização** | não recolhas a data de nascimento "porque pode dar jeito"; não guardes o JSON inteiro do pedido num log |
| **Exatidão** | o utilizador consegue corrigir os seus dados |
| **Limitação da conservação** | cada tipo de dado tem um prazo, e há um processo que apaga o que passou do prazo |
| **Integridade e confidencialidade** | cifra em trânsito (TLS) e em repouso, controlo de acessos, *passwords* com hash (módulo 13) |
| **Responsabilidade** | consegues **provar** que cumpres: registos, consentimentos guardados, decisões documentadas |

## 4. As bases legais

Todo o tratamento precisa de uma das seis bases do art. 6.º. As que mais aparecem num produto:

- **Execução de um contrato:** precisas do email e da morada para entregar a encomenda que a pessoa fez. Não é preciso pedir consentimento.
- **Obrigação legal:** as faturas guardam-se durante 10 anos em Portugal, por causa da lei fiscal, mesmo que o cliente peça para apagar a conta.
- **Interesse legítimo:** prevenção de fraude, segurança dos sistemas (logs de acesso). Exige ponderar se os interesses da pessoa não se sobrepõem.
- **Consentimento:** para o que não é necessário: newsletters, cookies de publicidade, analítica não essencial.

Um erro comum é pedir consentimento para tudo "por segurança": se o tratamento é necessário para o contrato, o consentimento é a base errada (e a pessoa poderia retirá-lo).

## 5. O consentimento

Para valer, o consentimento tem de ser **livre, específico, informado e inequívoco**: uma caixa por finalidade, não pré-assinalada, e tão fácil de retirar como de dar. E tens de conseguir **provar** que o tinhas: quem, para que finalidade, quando, e com que texto (se o texto do pedido mudar de forma relevante, os consentimentos antigos podem deixar de valer). É por isso que o consentimento se guarda como um **registo de eventos** (módulo 40): "dado", "retirado", nunca se apaga uma linha, e a pergunta "podia enviar-lhe a newsletter no dia 3 de março?" responde-se reproduzindo os eventos até essa data.

Os *banners* de cookies existem por causa de outra lei (a diretiva ePrivacy), mas seguem as mesmas regras: recusar tem de ser tão fácil como aceitar, e nada que não seja estritamente necessário se carrega antes da escolha.

## 6. Os direitos dos titulares

Os utilizadores podem pedir, e a organização tem **um mês** para responder:

- **Acesso** (art. 15.º): uma cópia de todos os dados que tens sobre a pessoa. Se os dados estão espalhados por 12 serviços sem um id comum, isto é um pesadelo; se o desenho o previu, é uma função.
- **Retificação** (art. 16.º).
- **Apagamento**, o "direito a ser esquecido" (art. 17.º): com exceções, como a obrigação legal de guardar faturas. Nesse caso, apaga-se o resto e **desliga-se** a fatura da conta. E não te esqueças das cópias: caches, índices de pesquisa, o *data warehouse*, os eventos no Kafka, e os *backups* (normalmente aceita-se que expirem pelo seu ciclo normal, desde que não sejam restaurados sem voltar a apagar).
- **Portabilidade** (art. 20.º): os dados num formato estruturado e legível por máquina (JSON, CSV).
- **Oposição** e **limitação** do tratamento.

## 7. Pseudonimização e anonimização

- **Anonimização:** já não é possível identificar a pessoa, por nenhum meio razoável. Dados verdadeiramente anónimos deixam de estar sujeitos ao RGPD. É mais difícil do que parece: combinar código postal, data de nascimento e género identifica a maior parte das pessoas.
- **Pseudonimização:** troca-se o identificador por um pseudónimo, e a informação para voltar atrás fica guardada à parte. Os dados **continuam a ser pessoais**, mas o risco desce muito, e a lei valoriza-o.

Um hash simples de um email **não** é um bom pseudónimo: quem tiver uma lista de emails calcula os hashes e compara. Um **HMAC** com uma chave secreta (guardada noutro sítio) resolve isso: o mesmo email dá sempre o mesmo pseudónimo (dá para contar utilizadores únicos na analítica), mas sem a chave não se consegue testar valores.

## 8. Logs, ambientes de teste e violações

Os **logs** são onde os dados pessoais mais escapam sem ninguém reparar: o corpo de um pedido com a *password*, um email numa mensagem de erro, um token num cabeçalho. Ficam guardados meses, copiados para o serviço de logs, vistos por toda a equipa. A defesa é por camadas: não registar corpos de pedidos por omissão, remover campos sensíveis pelo nome, e passar os textos por um filtro que apanhe emails, cartões e telefones (com cuidado com os falsos positivos: o algoritmo de Luhn distingue um número de cartão de um id de encomenda).

**Dados de produção em ambientes de teste** são outro clássico: uma cópia da base de dados para depurar um bug, num portátil. Usa dados sintéticos, ou uma cópia pseudonimizada.

Uma **violação de dados pessoais** (uma fuga, um acesso indevido, perda de dados) tem de ser comunicada à autoridade de controlo (em Portugal, a CNPD) em **72 horas** depois de se tomar conhecimento, e às pessoas afetadas se o risco for elevado. Os registos de quem acedeu a quê, e quando, são o que permite perceber o âmbito.

## 9. Transferências e fornecedores

Enviar dados pessoais para fora do Espaço Económico Europeu (um serviço de email nos EUA, um LLM noutro continente, módulo 55) exige uma garantia adequada: uma decisão de adequação da Comissão Europeia, ou cláusulas contratuais-tipo. Antes de mandar dados de utilizadores para um serviço novo, pergunta: que dados vão, para onde, com que contrato, e por quanto tempo ficam lá.

---

## Prática: escreve tu

As ferramentas de privacidade que mais se escrevem em código: minimizar e pseudonimizar, tirar dados pessoais dos logs, um registo de consentimentos que responde "tinha consentimento naquele dia?", e os direitos de acesso e de apagamento com prazos de conservação, numa base de dados Postgres (o PGlite) com faturas que a lei obriga a guardar.

**Ficheiros:** `pratica/53-rgpd-e-privacidade/` (`pseudonimizar.js`, `logsSemPii.js`, `consentimento.js`, `direitos.js`)

**Verificar:** `npm run verificar 53` (dentro de `pratica/`). Só um exercício: `npm run verificar 53 pseudonimizar`, `... 53 logsSemPii`, `... 53 consentimento` ou `... 53 direitos`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Minimizar, pseudonimizar e mascarar (≈20 min)

**Ficheiro:** `pseudonimizar.js`

Um filtro de campos, um pseudónimo com HMAC, e duas máscaras: para emails e para números compridos (IBAN, NIF), que mantêm os espaços.

**Sintaxe que vais praticar:** `Object.fromEntries`, `Object.hasOwn`, `createHmac` do `node:crypto`, `String.prototype.repeat`, percorrer uma string ao contrário.

<details>
<summary>Pista</summary>

Para a máscara do fim, percorre os caracteres do fim para o princípio com um contador de quantos ainda podes mostrar; os espaços passam sem gastar o contador. No fim, volta a inverter.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Minimização, pseudonimização e máscaras.
import { createHmac } from 'node:crypto';

// minimizar(objeto, campos) → um objeto novo só com os campos da lista (os que existem).
//   "Recolhe e guarda só o que precisas para a finalidade."
export function minimizar(objeto, campos) {
  return Object.fromEntries(campos.filter((c) => Object.hasOwn(objeto, c)).map((c) => [c, objeto[c]]));
}

// pseudonimo(valor, chave) → texto hexadecimal de 64 caracteres: o HMAC-SHA256 do valor com a chave.
//   O mesmo valor dá sempre o mesmo pseudónimo (dá para juntar dados do mesmo titular nas
//   análises), mas sem a chave não se consegue voltar ao valor nem testar valores à sorte.
//   O valor é normalizado antes: sem espaços nas pontas e em minúsculas.
export function pseudonimo(valor, chave) {
  return createHmac('sha256', chave).update(valor.trim().toLowerCase()).digest('hex');
}

// mascararEmail('ana.silva@exemplo.pt') → 'a********@exemplo.pt'
//   Mantém a primeira letra e o domínio; o resto da parte local passa a '*' (o mesmo número).
//   Um email com parte local de 1 letra fica 'a@...' . Texto sem '@' → lança um Error('Email inválido').
export function mascararEmail(email) {
  const i = email.lastIndexOf('@');
  if (i < 1) throw new Error('Email inválido');
  return email[0] + '*'.repeat(i - 1) + email.slice(i);
}

// mascararFim(texto, visiveis = 4) → só os últimos `visiveis` caracteres que não são espaços ficam
//   visíveis; os outros caracteres que não são espaços passam a '•'. Os espaços mantêm-se.
//   mascararFim('PT50 0002 0123 1234 5678 9015 4') → '•••• •••• •••• •••• •••• •015 4'
export function mascararFim(texto, visiveis = 4) {
  let porMostrar = visiveis;
  const fim = [];
  for (const c of [...texto].reverse()) {
    if (c === ' ') fim.push(c);
    else if (porMostrar > 0) {
      fim.push(c);
      porMostrar--;
    } else fim.push('•');
  }
  return fim.reverse().join('');
}
```
</details>

### P2 · Logs sem dados pessoais (≈30 min)

**Ficheiro:** `logsSemPii.js`

O algoritmo de Luhn, um filtro de texto para emails, cartões e telemóveis, e uma limpeza recursiva de objetos que remove campos sensíveis pelo nome.

**Sintaxe que vais praticar:** expressões regulares com `\b`, grupos não capturantes `(?:...)` e quantificadores `{12,18}`, `replace` com uma função, recursão sobre objetos e arrays.

<details>
<summary>Pista</summary>

Para os cartões, apanha com a expressão regular tudo o que **parece** um cartão e decide dentro da função do `replace`: tira os separadores (`m.replace(/\D/g, '')`) e só substitui se passar o Luhn. Na limpeza de objetos, trata os casos por ordem: texto, array, objeto, o resto.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Tirar dados pessoais dos logs.

// Nomes de campos cujo valor nunca deve ir para um log (comparação sem maiúsculas).
export const CAMPOS_SENSIVEIS = ['password', 'palavrapasse', 'token', 'authorization', 'nif', 'iban', 'cartao'];

// luhn(digitos) → true se a sequência de dígitos passar o algoritmo de Luhn (o dos cartões):
//   da direita para a esquerda, duplica um dígito sim, um não (começando no segundo); se o dobro
//   passar de 9, subtrai 9; a soma de tudo tem de ser múltipla de 10.
export function luhn(digitos) {
  let soma = 0;
  [...digitos].reverse().forEach((d, i) => {
    let n = Number(d);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
  });
  return soma % 10 === 0;
}

// limparTexto(texto) → o texto com os dados pessoais substituídos:
//   - emails → '[email]'
//   - números de cartão: 13 a 19 dígitos, que podem estar separados por espaços ou hífenes, e que
//     passam o Luhn → '[cartao]' (os que não passam ficam: são ids de encomendas, por exemplo)
//   - telemóveis portugueses: 9 dígitos começados por 9, opcionalmente com +351 antes e espaços
//     entre grupos de 3 → '[telefone]'
//   Os cartões tratam-se ANTES dos telefones (senão, um pedaço de um cartão podia parecer um telefone).
export function limparTexto(texto) {
  return texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[cartao]' : m))
    .replace(/(?:\+351 ?)?\b9\d{2} ?\d{3} ?\d{3}\b/g, '[telefone]');
}

// limparObjeto(valor) → uma cópia em que:
//   - os campos com nome em CAMPOS_SENSIVEIS passam a '[removido]' (em qualquer profundidade)
//   - os textos passam por limparTexto
//   - arrays e objetos são percorridos; os outros valores (números, booleanos, null) ficam iguais
export function limparObjeto(valor) {
  if (typeof valor === 'string') return limparTexto(valor);
  if (Array.isArray(valor)) return valor.map(limparObjeto);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, CAMPOS_SENSIVEIS.includes(k.toLowerCase()) ? '[removido]' : limparObjeto(v)]),
    );
  }
  return valor;
}
```
</details>

### P3 · Consentimento como registo de eventos (≈20 min)

**Ficheiro:** `consentimento.js`

Responder "este titular tinha consentimento para esta finalidade naquele instante?" a partir de eventos desordenados, com versões do texto, e listar a quem se pode enviar a newsletter.

**Sintaxe que vais praticar:** `filter` + `sort` por data, `at(-1)`, encadeamento opcional (`?.`), `Set`.

<details>
<summary>Pista</summary>

Filtra pelo titular, pela finalidade e pela data; ordena por data; o último evento decide. Sem eventos, `at(-1)` dá `undefined` e `?.` evita o erro.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Consentimento como um registo de eventos (nunca se apaga: precisas de PROVAR o que tinhas).

// Cada evento: { titular, finalidade, tipo: 'dado' | 'retirado', em: '2026-10-01T10:00:00Z', versaoTexto }

// temConsentimento(eventos, { titular, finalidade, em, versaoMinima = 1 }) → true/false
//   Olha só para os eventos desse titular e dessa finalidade com data <= em (o registo pode vir
//   desordenado). O último deles decide: 'dado' com versaoTexto >= versaoMinima → true.
//   (Se o texto do pedido de consentimento mudou de forma importante, os consentimentos dados
//   à versão antiga deixam de valer.) Sem eventos → false: o consentimento nunca se presume.
export function temConsentimento(eventos, { titular, finalidade, em, versaoMinima = 1 }) {
  const limite = Date.parse(em);
  const relevantes = eventos
    .filter((e) => e.titular === titular && e.finalidade === finalidade && Date.parse(e.em) <= limite)
    .sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  const ultimo = relevantes.at(-1);
  return ultimo?.tipo === 'dado' && ultimo.versaoTexto >= versaoMinima;
}

// titularesPara(eventos, { finalidade, em, versaoMinima }) → lista ORDENADA dos titulares que
//   têm consentimento para essa finalidade nesse instante (ex.: a quem se pode mandar a newsletter).
export function titularesPara(eventos, { finalidade, em, versaoMinima = 1 }) {
  const titulares = new Set(eventos.filter((e) => e.finalidade === finalidade).map((e) => e.titular));
  return [...titulares].filter((titular) => temConsentimento(eventos, { titular, finalidade, em, versaoMinima })).sort();
}
```
</details>

### P4 · Acesso, apagamento e conservação (≈30 min)

**Ficheiro:** `direitos.js`

Exportar tudo o que é de um titular, apagá-lo numa transação mantendo as faturas desligadas da conta, e apagar os logs de acesso que passaram do prazo.

**Sintaxe que vais praticar:** `db.transaction`, `affectedRows`, `UPDATE ... SET coluna = NULL`, aritmética de datas no Postgres (`make_interval`).

<details>
<summary>Pista</summary>

A ordem dentro da transação importa por causa das chaves estrangeiras: primeiro as linhas que apontam para o utilizador (apagar ou pôr a `NULL`), por fim o utilizador. Se alguma coisa falhar, o `throw` desfaz tudo. Na retenção, `$1::timestamptz - make_interval(days => $2)` dá o limite.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Direitos dos titulares (acesso e apagamento) e prazos de conservação, numa base de dados.
// Esquema (criado pelos testes):
//   utilizadores(id, email, nome)
//   tarefas(id, utilizador_id, titulo)
//   faturas(id, utilizador_id NULL, nif, valor, emitida_em)   -- obrigação legal: guardar 10 anos
//   acessos(id, utilizador_id, ip, em)                          -- logs de acesso

// exportarDados(db, id) → { utilizador, tarefas, faturas, acessos } (direito de acesso, art. 15.º)
//   utilizador: a linha do utilizador (ou lança um Error se não existir)
//   as outras: as linhas desse utilizador, ordenadas por id
export async function exportarDados(db, id) {
  const { rows } = await db.query('SELECT * FROM utilizadores WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error(`Utilizador ${id} não existe`);
  const de = async (tabela) => (await db.query(`SELECT * FROM ${tabela} WHERE utilizador_id = $1 ORDER BY id`, [id])).rows;
  return { utilizador: rows[0], tarefas: await de('tarefas'), faturas: await de('faturas'), acessos: await de('acessos') };
}

// apagarTitular(db, id) → { tarefas, acessos, faturasAnonimizadas } (direito ao apagamento, art. 17.º)
//   Numa transação: apaga as tarefas e os acessos; as faturas NÃO se apagam (a lei obriga a
//   guardá-las), mas deixam de apontar para o utilizador (utilizador_id = NULL); por fim apaga o
//   utilizador. Devolve quantas linhas de cada tipo foram afetadas.
export async function apagarTitular(db, id) {
  return db.transaction(async (tx) => {
    const tarefas = (await tx.query('DELETE FROM tarefas WHERE utilizador_id = $1', [id])).affectedRows;
    const acessos = (await tx.query('DELETE FROM acessos WHERE utilizador_id = $1', [id])).affectedRows;
    const faturasAnonimizadas = (await tx.query('UPDATE faturas SET utilizador_id = NULL WHERE utilizador_id = $1', [id])).affectedRows;
    await tx.query('DELETE FROM utilizadores WHERE id = $1', [id]);
    return { tarefas, acessos, faturasAnonimizadas };
  });
}

// aplicarRetencao(db, { agora, diasAcessos = 90 }) → quantos acessos apagou
//   Apaga os acessos com `em` anterior a (agora − diasAcessos dias). agora é um texto ISO.
export async function aplicarRetencao(db, { agora, diasAcessos = 90 }) {
  const r = await db.query("DELETE FROM acessos WHERE em < $1::timestamptz - make_interval(days => $2)", [agora, diasAcessos]);
  return r.affectedRows;
}
```
</details>

## Experiências

1. **Inventário de dados:** faz uma tabela com todos os dados pessoais que o workshop guarda (Postgres, Redis, logs, RabbitMQ, Kafka), com a finalidade, a base legal e o prazo de conservação de cada um. Onde é que um pedido de apagamento teria de chegar?
2. **Os teus logs:** liga a stack, faz login, cria tarefas, provoca erros, e procura nos logs da API (`docker compose logs api`) emails, tokens e corpos de pedidos. Aplica o `limparObjeto` no *logger*.
3. **O pedido de acesso:** acrescenta à API um `GET /api/me/export` que devolve um JSON com tudo o que é do utilizador autenticado.
4. **Re-identificação:** com uma lista de 1000 emails inventados, calcula o SHA-256 de cada um e mostra que consegues descobrir o email a partir do hash; repete com o HMAC e uma chave.

## Perguntas de pensamento crítico

1. Um utilizador pede para apagar a conta, mas tem faturas dos últimos 3 anos. O que apagas, o que guardas, e porquê?
2. Porque é que guardar `sha256(email)` na analítica não torna os dados anónimos? O que fazias em vez disso?
3. A equipa de marketing quer usar os emails dos clientes para uma newsletter nova. Que perguntas fazes antes de escrever o código?

<details>
<summary>Respostas</summary>

1. Apagas o que já não tem base legal: a conta, as tarefas, os logs de acesso, as preferências, e as cópias noutros sistemas (caches, índices, analítica). Guardas as faturas, porque há uma obrigação legal (fiscal) de as conservar durante 10 anos; mas desligas a fatura da conta e só guardas o que a lei exige (dados de faturação). No fim do prazo legal, as faturas também se apagam. Respondes ao titular a explicar o que foi apagado e o que ficou, e porquê.
2. Porque continua a ser possível chegar à pessoa: quem tiver uma lista de emails (uma fuga antiga, a própria base de clientes) calcula os hashes e compara, e um hash é sempre o mesmo para o mesmo email. São dados pseudonimizados, no máximo, e fracos. Em vez disso: um HMAC com uma chave secreta guardada fora da analítica (sem a chave não se testa nada), ou um id aleatório por utilizador; e, se possível, agregar (contagens) em vez de guardar eventos individuais.
3. Que base legal tem esta finalidade (normalmente o consentimento, ou o interesse legítimo para clientes, com regras próprias e oposição fácil)? Os clientes consentiram para esta finalidade e com que texto, e consegues prová-lo? Como se retira o consentimento (um link em cada email)? Que serviço envia os emails, onde estão os servidores, e há um contrato com ele? Que dados é que esse serviço recebe (só o email, ou mais do que o necessário)? Por quanto tempo os guarda?
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 53`.

**1.** Um endereço IP é um dado pessoal?

- a) Nunca
- b) Pode ser: é informação sobre uma pessoa identificável com meios razoáveis
- c) Só se for IPv6
- d) Só se estiver junto do nome

<details><summary>Resposta</summary>

**b) Pode ser: é informação sobre uma pessoa identificável com meios razoáveis** — O critério é se dá para chegar à pessoa, não se o nome está lá.

</details>

**2.** Que base legal justifica guardar o email e a morada para entregar uma encomenda?

- a) Consentimento
- b) Execução de um contrato
- c) Interesse público
- d) Nenhuma: não é preciso

<details><summary>Resposta</summary>

**b) Execução de um contrato** — O consentimento seria a base errada: é necessário para o contrato e não pode ser retirado a meio.

</details>

**3.** Que construção criptográfica, com uma chave secreta, dá um pseudónimo estável que não se consegue testar com uma lista de valores (sigla)?

<details><summary>Resposta</summary>

**hmac** — Um hash simples é vulnerável a quem tem uma lista de candidatos; o HMAC exige a chave.

</details>

**4.** Um utilizador pede para apagar a conta mas tem faturas. O que se faz às faturas?

- a) Apagam-se também
- b) Guardam-se pelo prazo legal, desligadas da conta
- c) Ficam ligadas à conta para sempre
- d) Enviam-se ao utilizador e apagam-se

<details><summary>Resposta</summary>

**b) Guardam-se pelo prazo legal, desligadas da conta** — A obrigação legal é uma exceção ao direito ao apagamento.

</details>

**5.** Em quanto tempo deve uma violação de dados pessoais ser comunicada à autoridade de controlo?

- a) 24 horas
- b) 72 horas
- c) Um mês
- d) Só se houver coima

<details><summary>Resposta</summary>

**b) 72 horas** — 72 horas depois de se tomar conhecimento; às pessoas afetadas se o risco for elevado.

</details>

<!-- quiz:end -->
