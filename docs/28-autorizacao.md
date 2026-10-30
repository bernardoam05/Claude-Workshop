# 28 · Autorização: RBAC, ABAC e ReBAC

**Objetivo:** distinguir autenticação (quem és) de autorização (o que podes fazer), e conhecer os três modelos que se usam na indústria: papéis (RBAC), atributos e políticas (ABAC) e relações (ReBAC, o modelo do Google Zanzibar). E aprender o erro mais comum: verificar a permissão de um objeto e esquecer as listas.

**Ficheiros para ler:** `src/api/src/middleware/auth.js`, `src/api/src/services/taskService.js` (a regra "só o dono") e a configuração de papéis do Keycloak usada pelo serviço Spring (módulo 18).

**Pré-requisitos:** módulos 15 (autenticação e papéis no Keycloak) e 26 (OWASP: IDOR e controlo de acessos).

---

## 1. Autenticação não é autorização

O módulo 15 respondeu a "quem és?": um token assinado diz que este pedido é da Ana. A **autorização** responde a outra pergunta: "a Ana pode apagar a tarefa 42?". A falha de controlo de acessos é a número 1 do OWASP Top 10 (módulo 26), e quase sempre é uma destas: a verificação não existe numa rota (IDOR: trocar o id no URL e ver os dados de outro), existe na interface mas não na API, ou existe para um objeto mas não na listagem.

Hoje o workshop tem a regra mais simples possível: cada tarefa tem um dono, e só ele a vê e muda (mais um papel `admin` no serviço Spring). Assim que aparecem equipas, partilhas e projetos, esta regra deixa de chegar, e é aí que entram os modelos.

## 2. RBAC: papéis

No **RBAC** (*role-based access control*), as permissões não se dão às pessoas, dão-se aos **papéis**, e as pessoas têm papéis: `leitor`, `editor`, `gestor`, `admin`. Os papéis podem **herdar** outros (o `editor` tem tudo o que o `leitor` tem, e mais). As permissões escrevem-se como `recurso:acao` (`tarefa:editar`), com curingas (`tarefa:*`).

É simples de perceber, de auditar ("quem pode apagar?") e de gerir num IdP como o Keycloak. Os limites aparecem depressa:

- não exprime **"só as tuas"**: o `editor` pode editar **que** tarefas? Todas?
- a **explosão de papéis**: `editor-projeto-7`, `editor-projeto-8`... um papel por combinação.

Na prática, o RBAC usa-se para as permissões gerais ("pode aceder ao painel de faturação") e combina-se com outra coisa para as regras sobre objetos.

## 3. ABAC: atributos e políticas

No **ABAC** (*attribute-based access control*), cada decisão é uma **política** sobre atributos do sujeito (departamento, equipa, nível), do recurso (dono, estado, classificação), da ação, e do **contexto** (hora, IP, se o dispositivo é gerido):

```
permitir  editar  se  recurso.dono == sujeito.id
negar     editar  se  recurso.arquivada
negar     apagar  se  contexto.hora fora de 8h–20h
```

É muito expressivo, e as regras para combinar políticas são as mesmas em todo o lado:

- **negado por omissão**: sem nenhuma política que permita, não;
- **negar ganha a permitir** (*deny overrides*): uma exceção restritiva não pode ser contornada por uma regra geral;
- **falhar fechado**: se avaliar uma política der erro (um atributo em falta), a resposta é "não".

O custo é a dificuldade de responder à pergunta ao contrário: "a que é que a Ana tem acesso?" exige avaliar as políticas para todos os recursos.

## 4. ReBAC: relações

O **ReBAC** (*relationship-based access control*) parte da observação de que, nas aplicações colaborativas, as permissões vêm de **relações**: a Ana é **dona** deste documento; o documento está **dentro** desta pasta; os **membros** da equipa de engenharia são **leitores** da pasta. Foi o modelo que a Google descreveu no artigo do **Zanzibar** (2019), o sistema por trás das permissões do Drive, do YouTube e do Calendar, e que hoje existe em código aberto no **SpiceDB** e no **OpenFGA**.

Os dados são **tuplos** (`documento:d1#dono@utilizador:ana`) e o **modelo** diz como as relações se derivam umas das outras: "quem é dono também é editor", "quem é editor também é leitor", "quem é leitor da pasta-mãe é leitor do documento". Responder a "a Ana pode ler o d1?" é percorrer esse grafo. Exprime naturalmente partilhas, grupos dentro de grupos e hierarquias de pastas, que em RBAC ou ABAC ficam complicados.

## 5. Políticas como código

Em sistemas maiores, a lógica de autorização sai do código de cada serviço para um sítio comum, escrita como código, versionada e testada:

- o **OPA** (*Open Policy Agent*), com a linguagem **Rego**, usado tanto em aplicações como no Kubernetes (módulo 32) e no Terraform (módulo 33);
- o **Cedar** (da AWS), uma linguagem de políticas pensada para ser analisada;
- os serviços ReBAC (SpiceDB, OpenFGA), para as relações.

A aplicação pergunta "pode?" e recebe sim ou não, com o motivo (útil para a auditoria e para depurar).

## 6. O erro das listas

Verificar `podeVer(utilizador, tarefa)` num `GET /tarefas/42` é a parte fácil. O erro clássico está na **listagem**: carregar as tarefas todas e filtrar em memória (lento, e paginar fica errado), ou pior, esquecer o filtro numa listagem, numa exportação, numa pesquisa (módulo 42), num relatório. As regras de "quem vê o quê" têm de estar **na consulta**, numa só ida à base de dados, e têm de bater **exatamente** com as verificações individuais. Um teste que compara as duas para todos os pares de utilizadores e objetos apanha as divergências. E num sistema com vários clientes (multi-inquilino, módulo 39), a primeira barreira é o próprio Postgres, com *row-level security*.

## 7. Onde verificar

- **No servidor, sempre.** Esconder o botão na interface é experiência do utilizador, não segurança.
- **O mais perto possível dos dados**: na camada de serviço (módulo 04), que todas as rotas usam, e não espalhado pelas rotas.
- **Responde `404` em vez de `403`** a quem nem sequer pode saber que o recurso existe (não confirmes que a tarefa 42 existe a quem não a pode ver).
- **Regista as decisões negadas**: um pico de `403` é muitas vezes alguém a experimentar ids.

---

## Prática: escreve tu

Os três modelos, escritos de raiz: RBAC com herança, curingas e deteção de ciclos; um avaliador ABAC com negar a ganhar, negado por omissão e falhar fechado; um motor ReBAC ao estilo do Zanzibar, com grupos dentro de grupos e hierarquias de pastas; e a autorização dentro das consultas SQL, com a lista e as verificações individuais sempre de acordo.

**Ficheiros:** `pratica/28-autorizacao/` (`rbac.js`, `abac.js`, `rebac.js`, `consultas.js`)

**Verificar:** `npm run verificar 28` (dentro de `pratica/`). Só um exercício: `npm run verificar 28 rbac`, `... 28 abac`, `... 28 rebac` ou `... 28 consultas`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · RBAC (≈25 min)

**Ficheiro:** `rbac.js`

Resolver as permissões de cada papel com as herdadas (detetando ciclos e papéis em falta), e decidir com permissões exatas, curingas de recurso e o `*`.

**Sintaxe que vais praticar:** recursão com o caminho percorrido (para os ciclos), um `Map` como *cache*, `Set` para tirar repetidos, `endsWith`/`startsWith`.

<details>
<summary>Pista</summary>

Uma função recursiva `resolver(papel, caminho)`: se o papel já está no caminho, é um ciclo; senão, junta as permissões próprias com as de cada papel herdado (chamando-se a si própria com o caminho acrescentado). Resolve todos os papéis logo na criação, para os erros aparecerem cedo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · RBAC: papéis com permissões, e papéis que herdam outros.

// criarRbac(papeis) → { permissoesDe(papel), pode(papeisDoUtilizador, permissao) }
//   papeis: { leitor: { permissoes: ['tarefa:ler'] }, editor: { herda: ['leitor'], permissoes: [...] }, ... }
//   Na criação (lança Error):
//   - um papel que herda um papel inexistente → mensagem com o nome em falta
//   - um ciclo de heranças (a herda b, b herda a) → mensagem com 'Ciclo'
//   permissoesDe(papel) → lista ORDENADA e sem repetidos das permissões do papel e de todos os que
//     ele herda (direta ou indiretamente). Papel desconhecido → [].
//   pode(papeis, permissao) → true se algum dos papéis tiver uma permissão que cubra a pedida:
//     igual ('tarefa:ler'), um curinga do recurso ('tarefa:*' cobre 'tarefa:apagar'), ou '*' (tudo).
export function criarRbac(papeis) {
  const cache = new Map();
  function resolver(papel, caminho) {
    if (caminho.includes(papel)) throw new Error(`Ciclo de papéis: ${[...caminho, papel].join(' → ')}`);
    if (cache.has(papel)) return cache.get(papel);
    const def = papeis[papel];
    const todas = new Set(def.permissoes ?? []);
    for (const pai of def.herda ?? []) {
      if (!Object.hasOwn(papeis, pai)) throw new Error(`O papel ${papel} herda um papel que não existe: ${pai}`);
      for (const p of resolver(pai, [...caminho, papel])) todas.add(p);
    }
    const lista = [...todas].sort();
    cache.set(papel, lista);
    return lista;
  }
  for (const papel of Object.keys(papeis)) resolver(papel, []);
  const cobre = (tem, pedida) => tem === '*' || tem === pedida || (tem.endsWith(':*') && pedida.startsWith(tem.slice(0, -1)));
  return {
    permissoesDe: (papel) => (Object.hasOwn(papeis, papel) ? cache.get(papel) : []),
    pode(papeisDoUtilizador, permissao) {
      return papeisDoUtilizador.some((papel) => (Object.hasOwn(papeis, papel) ? cache.get(papel) : []).some((p) => cobre(p, permissao)));
    },
  };
}
```
</details>

### P2 · ABAC (≈20 min)

**Ficheiro:** `abac.js`

Avaliar uma lista de políticas: quais se aplicam, negar a ganhar, negado por omissão, e uma condição que rebenta a dar "não".

**Sintaxe que vais praticar:** funções guardadas em objetos, `try/catch` à volta de código que não controlas, `find`, comparar com `=== true`.

<details>
<summary>Pista</summary>

Primeiro junta as políticas aplicáveis (ação certa e condição verdadeira), saindo logo com "erro em ..." se uma condição lançar. Depois decide: alguma de negar? alguma de permitir? nenhuma?
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · ABAC: decisões a partir de atributos do sujeito, do recurso e do contexto.

// avaliar(politicas, pedido) → { permitido, motivo }
//   pedido: { sujeito, acao, recurso, contexto }
//   politicas: [{ id, efeito: 'permitir' | 'negar', acoes: ['editar', ...] ou ['*'], condicao?: (pedido) => boolean }]
//   Uma política aplica-se se a ação estiver nas suas acoes (ou houver '*') e a condição (se
//   existir) der true. Regras:
//   - se uma condição LANÇAR um erro → { permitido: false, motivo: 'erro em <id>' } (falhar fechado)
//   - alguma 'negar' aplicável → { permitido: false, motivo: <id da primeira> } (negar ganha sempre)
//   - senão, alguma 'permitir' aplicável → { permitido: true, motivo: <id da primeira> }
//   - senão → { permitido: false, motivo: 'nenhuma política' } (negado por omissão)
export function avaliar(politicas, pedido) {
  const aplicaveis = [];
  for (const p of politicas) {
    if (!p.acoes.includes(pedido.acao) && !p.acoes.includes('*')) continue;
    let sim;
    try {
      sim = p.condicao ? p.condicao(pedido) === true : true;
    } catch {
      return { permitido: false, motivo: `erro em ${p.id}` };
    }
    if (sim) aplicaveis.push(p);
  }
  const negar = aplicaveis.find((p) => p.efeito === 'negar');
  if (negar) return { permitido: false, motivo: negar.id };
  const permitir = aplicaveis.find((p) => p.efeito === 'permitir');
  if (permitir) return { permitido: true, motivo: permitir.id };
  return { permitido: false, motivo: 'nenhuma política' };
}
```
</details>

### P3 · ReBAC ao estilo do Zanzibar (≈40 min)

**Ficheiro:** `rebac.js`

Ler os tuplos, e verificar relações diretas, através de conjuntos (`grupo:eng#membro`), derivadas no mesmo objeto (`editor` → `leitor`) e através de outra relação (`pai->leitor`), sem ficar preso em ciclos.

**Sintaxe que vais praticar:** expressões regulares com grupos para partir os tuplos, recursão sobre um grafo com um `Set` do caminho atual, `split('->')` com desestruturação.

<details>
<summary>Pista</summary>

`verificar(objeto, relacao, sujeito)` tem três fontes: (1) os tuplos `objeto#relacao@...` (o sujeito exato, ou um conjunto `X#rel` em que verificas `X rel sujeito`); (2) cada regra simples do modelo (`'editor'`: verificar o mesmo objeto com a outra relação); (3) cada regra `via->rel` (para cada tuplo `objeto#via@Y`, verificar `Y rel sujeito`). Passa um `Set` com os pares objeto#relacao em curso, para não voltar a um que já está a ser verificado.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · ReBAC: permissões a partir de relações (o modelo do Zanzibar da Google, do SpiceDB e do OpenFGA).
//
// Tuplos: 'objeto#relacao@sujeito', em que o sujeito é um utilizador ('utilizador:ana') ou um
// conjunto ('grupo:eng#membro' = todos os membros do grupo eng). Exemplos:
//   'documento:d1#dono@utilizador:ana'      a Ana é dona do d1
//   'grupo:eng#membro@utilizador:rui'        o Rui é membro do grupo eng
//   'pasta:p1#leitor@grupo:eng#membro'       os membros do eng são leitores da p1
//   'documento:d1#pai@pasta:p1'              o d1 está dentro da p1
// Modelo: por tipo, cada relação diz de onde MAIS vem (além dos tuplos diretos):
//   { documento: { dono: [], editor: ['dono'], leitor: ['editor', 'pai->leitor'] }, ... }
//   'editor'      → quem é editor do mesmo objeto também é leitor
//   'pai->leitor' → para cada X com objeto#pai@X, quem é leitor de X também é leitor deste

// criarReBAC(modelo, tuplos) → { verificar(objeto, relacao, sujeito), listar(tipo, relacao, sujeito) }
//   verificar → true/false (cuidado com os ciclos: um conjunto que já está a ser verificado não se
//     volta a verificar). Uma relação que não existe no modelo para esse tipo → lança Error.
//   listar → os objetos desse tipo (os que aparecem nos tuplos como objeto) em que o sujeito tem
//     a relação, por ordem alfabética
export function criarReBAC(modelo, tuplos) {
  const lidos = tuplos.map((t) => {
    const m = /^([^#]+)#([^@]+)@(.+)$/.exec(t);
    if (!m) throw new Error(`Tuplo inválido: ${t}`);
    return { objeto: m[1], relacao: m[2], sujeito: m[3] };
  });
  function verificar(objeto, relacao, sujeito, emCurso = new Set()) {
    const chave = `${objeto}#${relacao}`;
    if (emCurso.has(chave)) return false;
    const tipo = objeto.split(':')[0];
    const regras = modelo[tipo]?.[relacao];
    if (!regras) throw new Error(`O tipo ${tipo} não tem a relação ${relacao}`);
    const visitados = new Set(emCurso).add(chave);
    for (const t of lidos) {
      if (t.objeto !== objeto || t.relacao !== relacao) continue;
      if (t.sujeito === sujeito) return true;
      const conjunto = /^(.+)#(.+)$/.exec(t.sujeito);
      if (conjunto && verificar(conjunto[1], conjunto[2], sujeito, visitados)) return true;
    }
    for (const r of regras) {
      const [via, rel] = r.split('->');
      if (rel === undefined) {
        if (verificar(objeto, via, sujeito, visitados)) return true;
      } else {
        for (const t of lidos) {
          if (t.objeto === objeto && t.relacao === via && verificar(t.sujeito, rel, sujeito, visitados)) return true;
        }
      }
    }
    return false;
  }
  return {
    verificar: (objeto, relacao, sujeito) => verificar(objeto, relacao, sujeito),
    listar(tipo, relacao, sujeito) {
      const objetos = [...new Set(lidos.map((t) => t.objeto).filter((o) => o.startsWith(`${tipo}:`)))];
      return objetos.filter((o) => verificar(o, relacao, sujeito)).sort();
    },
  };
}
```
</details>

### P4 · Autorização nas consultas (≈25 min)

**Ficheiro:** `consultas.js`

A lista das tarefas que um utilizador vê, numa só consulta, e as verificações de ver e de editar, com as mesmas regras (os testes comparam-nas para todos os pares).

**Sintaxe que vais praticar:** `EXISTS (SELECT 1 ...)` correlacionado, um parâmetro booleano (`WHERE $2 OR ...`), `ORDER BY`.

<details>
<summary>Pista</summary>

Cada regra de "vê" é uma condição num `OR`: `t.dono = $1`, um `EXISTS` na tabela `membros` para o projeto da tarefa, outro na `partilhas`. O admin é um parâmetro booleano no início do `OR`. Escreve a mesma condição nas duas funções (ou numa constante partilhada), para nunca divergirem.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Autorização dentro das consultas: filtrar no SQL, e não carregar tudo e filtrar em memória.
// Tabelas (criadas pelos testes):
//   tarefas(id, titulo, dono, projeto_id)
//   membros(projeto_id, utilizador, papel)   -- papel: 'leitor' | 'editor'
//   partilhas(tarefa_id, utilizador)
// Regras: um utilizador { id, admin } VÊ uma tarefa se for admin, o dono, membro do projeto (qualquer
// papel) ou se a tarefa tiver sido partilhada com ele. EDITA se for admin, o dono, ou editor do projeto.

// tarefasVisiveis(db, utilizador) → as tarefas que ele vê, por id, com UMA só consulta
export async function tarefasVisiveis(db, { id, admin }) {
  const { rows } = await db.query(
    `SELECT t.* FROM tarefas t
      WHERE $2
         OR t.dono = $1
         OR EXISTS (SELECT 1 FROM membros m WHERE m.projeto_id = t.projeto_id AND m.utilizador = $1)
         OR EXISTS (SELECT 1 FROM partilhas p WHERE p.tarefa_id = t.id AND p.utilizador = $1)
      ORDER BY t.id`,
    [id, Boolean(admin)],
  );
  return rows;
}

// podeVer(db, utilizador, tarefaId) → true/false (as MESMAS regras: tem de bater sempre com a lista)
export async function podeVer(db, utilizador, tarefaId) {
  const { rows } = await db.query(
    `SELECT 1 FROM tarefas t
      WHERE t.id = $3 AND ($2
         OR t.dono = $1
         OR EXISTS (SELECT 1 FROM membros m WHERE m.projeto_id = t.projeto_id AND m.utilizador = $1)
         OR EXISTS (SELECT 1 FROM partilhas p WHERE p.tarefa_id = t.id AND p.utilizador = $1))`,
    [utilizador.id, Boolean(utilizador.admin), tarefaId],
  );
  return rows.length > 0;
}

// podeEditar(db, utilizador, tarefaId) → true/false
export async function podeEditar(db, { id, admin }, tarefaId) {
  const { rows } = await db.query(
    `SELECT 1 FROM tarefas t
      WHERE t.id = $3 AND ($2
         OR t.dono = $1
         OR EXISTS (SELECT 1 FROM membros m WHERE m.projeto_id = t.projeto_id AND m.utilizador = $1 AND m.papel = 'editor'))`,
    [id, Boolean(admin), tarefaId],
  );
  return rows.length > 0;
}
```
</details>

## Experiências

1. **IDOR no workshop:** com dois utilizadores (Ana e Rui), cria uma tarefa com a Ana e tenta `GET`, `PATCH` e `DELETE` a essa tarefa com o token do Rui (`curl`). Que códigos responde a API? É `403` ou `404`? Porquê?
2. **O OPA:** corre `docker run -p 127.0.0.1:8181:8181 openpolicyagent/opa:latest run --server` e carrega uma política em Rego que reproduz as regras do P2 (`PUT /v1/policies/...`). Pergunta-lhe com `curl -d '{"input": ...}' localhost:8181/v1/data/...`.
3. **O OpenFGA:** no *playground* do OpenFGA (online), escreve o modelo do P3 na linguagem deles e os mesmos tuplos, e confirma as mesmas respostas.
4. **Partilhas na API:** acrescenta à API do workshop uma tabela `partilhas` e muda a listagem de tarefas para incluir as partilhadas, com a condição na consulta, como no P4.

## Perguntas de pensamento crítico

1. Uma equipa tem 340 papéis no Keycloak, muitos com nomes como `editor-projeto-17`. O que é que isto diz sobre o modelo de autorização, e o que propunhas?
2. Porque é que "negar ganha a permitir" e "negado por omissão" são as regras certas, e não o contrário?
3. A interface só mostra o botão "apagar" ao dono da tarefa. Isto é suficiente?

<details>
<summary>Respostas</summary>

1. Que se está a usar o RBAC para exprimir permissões sobre **objetos** (este projeto), que é o que ele faz mal: há uma explosão de papéis, difíceis de gerir e de auditar. Propunha manter poucos papéis globais (`membro`, `admin`, `faturação`) e passar as permissões por projeto para relações (uma tabela de membros por projeto com o papel lá dentro, ou um modelo ReBAC como o do P3), verificadas na aplicação ou num serviço como o OpenFGA.
2. Porque os erros de autorização devem acontecer do lado seguro. Negado por omissão: uma ação ou recurso novo sem política fica inacessível até alguém decidir, em vez de ficar aberto por esquecimento. Negar ganha: as restrições (uma conta suspensa, um recurso arquivado, uma regra legal) não podem ser anuladas por uma permissão geral que alguém acrescentou depois. O contrário deixa as falhas silenciosas, que são as que se descobrem tarde.
3. Não. É só experiência do utilizador: qualquer pessoa consegue fazer o `DELETE` diretamente à API (com `curl`, ou mudando o JavaScript no browser). A verificação tem de estar no servidor, na camada de serviço que todas as rotas usam, e testada; a interface apenas não mostra o que não vai funcionar.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 28`.

**1.** Qual é a diferença entre autenticação e autorização?

- a) São sinónimos
- b) Autenticação é quem és; autorização é o que podes fazer
- c) Autenticação é no browser; autorização no servidor
- d) Autorização é só para admins

<details><summary>Resposta</summary>

**b) Autenticação é quem és; autorização é o que podes fazer** — O módulo 15 trata da primeira; este módulo da segunda.

</details>

**2.** Qual é o problema típico do RBAC quando se quer 'editor só do projeto 7'?

- a) Não suporta herança
- b) A explosão de papéis: um papel por combinação
- c) Não funciona com o Keycloak
- d) É lento

<details><summary>Resposta</summary>

**b) A explosão de papéis: um papel por combinação** — Permissões sobre objetos ficam melhor em relações ou atributos.

</details>

**3.** Que sistema da Google, descrito num artigo de 2019, popularizou o controlo de acessos baseado em relações (ReBAC)?

<details><summary>Resposta</summary>

**zanzibar** — Hoje existe em código aberto no SpiceDB e no OpenFGA.

</details>

**4.** Num avaliador de políticas, uma condição lança um erro. Qual deve ser a decisão?

- a) Permitir
- b) Negar (falhar fechado)
- c) Ignorar essa política
- d) Repetir até funcionar

<details><summary>Resposta</summary>

**b) Negar (falhar fechado)** — Os erros de autorização devem acontecer do lado seguro.

</details>

**5.** Onde devem estar as regras de 'quem vê o quê' numa listagem de tarefas?

- a) Na interface
- b) Num filtro em memória depois de carregar tudo
- c) Na própria consulta SQL, a bater com as verificações individuais
- d) Só nos logs

<details><summary>Resposta</summary>

**c) Na própria consulta SQL, a bater com as verificações individuais** — Uma ida à base de dados, paginação correta, e nenhuma listagem esquecida.

</details>

<!-- quiz:end -->
