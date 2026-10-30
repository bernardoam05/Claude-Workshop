# 56 · Desempenho e acessibilidade no frontend

**Objetivo:** fazer páginas que carregam depressa, não saltam, respondem logo aos cliques, e que toda a gente consegue usar, incluindo quem usa só o teclado ou um leitor de ecrã. Medir com as Core Web Vitals (LCP, CLS, INP) e com o axe, num browser a sério (o Playwright do módulo 09).

**Ficheiros para ler:** `src/web/index.html`, `src/web/src/` (o frontend React do módulo 08) e `src/web/vite.config.js`.

**Pré-requisitos:** módulos 08 (React), 09 (CSS e Playwright) e 43 (cache HTTP).

---

## 1. Porque é que isto é contigo

Os dois temas parecem "polimento", mas são requisitos:

- **Desempenho** é dinheiro: os estudos da Google e de lojas online mostram, repetidamente, que cada segundo a mais no carregamento faz cair as conversões. E o Google usa as Core Web Vitals na ordenação das pesquisas. A maior parte dos utilizadores não tem o teu portátil nem a tua fibra: tem um telemóvel de gama média numa rede móvel.
- **Acessibilidade** é para pessoas: cerca de uma em cada seis pessoas tem alguma deficiência (visual, motora, auditiva, cognitiva), e toda a gente tem limitações temporárias (um braço partido, sol no ecrã). E é lei: a **Diretiva Europeia de Acessibilidade** (*European Accessibility Act*) aplica-se desde junho de 2025 a muitos produtos e serviços digitais privados (lojas online, bancos, transportes), e os sítios públicos portugueses já tinham obrigações (Decreto-Lei 83/2018). A referência técnica é a **WCAG 2.2**, nível AA.

## 2. As Core Web Vitals

Três métricas medidas nos browsers dos utilizadores reais (o *Chrome UX Report*), cada uma com um limiar "bom" no percentil 75 (módulo 48):

| Métrica | Mede | Bom |
|---|---|---|
| **LCP** (*Largest Contentful Paint*) | quando aparece o maior elemento visível (normalmente a imagem principal ou o título) | ≤ 2,5 s |
| **CLS** (*Cumulative Layout Shift*) | quanto o conteúdo salta de sítio enquanto a página carrega | ≤ 0,1 |
| **INP** (*Interaction to Next Paint*) | quanto tempo a página demora a reagir visualmente a um clique ou tecla | ≤ 200 ms |

Medem-se em dois sítios: **no laboratório** (o Lighthouse nas ferramentas do Chrome, ou testes automáticos como os desta prática), que é reprodutível mas não é a realidade; e **no terreno** (*RUM*, *real user monitoring*: a biblioteca `web-vitals` envia as métricas dos utilizadores reais para a tua analítica), que é a verdade mas tem ruído. O INP, em particular, só se mede bem no terreno, porque depende do que as pessoas clicam.

## 3. Carregar depressa (LCP)

O caminho até à primeira pintura chama-se o **caminho crítico de renderização**: o browser descarrega o HTML, encontra CSS e scripts, e só pinta quando tem o CSS e correu os scripts que **bloqueiam**. As regras:

- **Scripts com `defer`** (ou `type="module"`, que é `defer` por omissão): descarregam em paralelo e correm depois de o HTML estar lido, por ordem. `async` corre assim que chega (para scripts independentes, como a analítica). Um `<script src>` simples no `<head>` pára tudo até chegar e correr: se for de um terceiro lento, a página fica em branco.
- **Menos JavaScript**: cada KB de JS custa descarregar, interpretar e executar, e um telemóvel é 4 a 10 vezes mais lento a executar do que um portátil. Divide o código por rota (*code splitting*, o `import()` dinâmico que o Vite já suporta), e mede o tamanho com o relatório do build.
- **A imagem principal primeiro**: `fetchpriority="high"` na imagem do LCP; nunca `loading="lazy"` nela; formatos modernos (AVIF, WebP) e tamanhos certos com `srcset` e `sizes`.
- **Tudo o que está abaixo da dobra, depois**: `loading="lazy"` em imagens e `iframe`s que não se veem ao abrir a página.
- **Fontes**: `font-display: swap` (mostra o texto com uma fonte do sistema enquanto a fonte chega), e `preload` só da fonte do texto principal.
- **Rede e cache**: HTTP/2 ou 3, compressão (brotli), uma CDN, e a cache do módulo 43.

## 4. Não saltar (CLS)

Estás a ler um artigo, aparece uma imagem por cima, e o texto foge; vais carregar em "Cancelar" e um anúncio empurra o botão "Comprar" para debaixo do dedo. Isso é o CLS, e as causas são sempre as mesmas:

- **Imagens e vídeos sem dimensões**: o browser não sabe quanto espaço reservar até a imagem chegar. Põe `width` e `height` no HTML (com `height: auto` no CSS, ele calcula a proporção) ou `aspect-ratio` no CSS.
- **Conteúdo inserido por cima** do que já está (avisos de cookies, anúncios, *banners*): reserva o espaço antes, ou mostra-o por cima (sobreposto) em vez de empurrar.
- **Fontes** que mudam o tamanho do texto ao chegar: `size-adjust` e fontes de recurso com métricas parecidas.

As mudanças que acontecem logo a seguir a uma ação do utilizador (abrir um menu ao clicar) não contam.

## 5. Responder depressa (INP)

O browser tem **uma só thread principal** para correr o teu JavaScript, calcular o layout e pintar. Enquanto um script corre, nada mais acontece: o clique fica em fila, a animação para, o texto escrito não aparece. Uma **tarefa longa** é qualquer tarefa com mais de 50 ms, e é a causa número um de um INP mau.

As soluções, por ordem:

1. **Fazer menos**: não renderizar 5000 linhas de uma vez (paginação ou virtualização da lista), não recalcular o que não mudou (`useMemo`, `React.memo`, módulo 08), *debounce* na pesquisa enquanto se escreve (módulo 58).
2. **Partir o trabalho** em pedaços e **ceder** a thread entre eles, para o browser tratar os cliques e pintar: `await scheduler.yield()` (no Chrome) ou `await new Promise((r) => setTimeout(r, 0))`. O `scheduler.yield()` tem a vantagem de a continuação passar à frente das outras tarefas em fila, mas não à frente da interação do utilizador.
3. **Tirar o trabalho da thread principal**: um **Web Worker** corre JavaScript noutra thread (sem acesso ao DOM), e fala com a página por mensagens. É o sítio certo para processar ficheiros, cálculos pesados ou pesquisa em muitos dados.
4. **Responder primeiro, trabalhar depois**: atualizar logo a interface (um botão desativado, um indicador de progresso) e só depois começar o trabalho.

## 6. Acessibilidade: os fundamentos

A maior parte da acessibilidade vem de graça com **HTML semântico**, e perde-se a fazer tudo com `<div>`:

- **Usa os elementos certos.** Um `<button>` recebe foco, ativa com Enter e Espaço, e um leitor de ecrã diz "botão". Uma `<div onclick>` não faz nada disso. O mesmo para `<a href>` (navegar), `<label>`, `<nav>`, `<main>`, `<dialog>`. A primeira regra do ARIA é: não uses ARIA se houver um elemento HTML que faça o mesmo.
- **Tudo tem um nome**: imagens com `alt` (que descreve a função, não "imagem de..."; `alt=""` nas decorativas), campos com `<label for>` (o `placeholder` não substitui a etiqueta: desaparece ao escrever), botões e links com texto (ou `aria-label` se só tiverem um ícone).
- **Teclado**: tudo o que se faz com o rato tem de se fazer com o teclado, pela ordem visual, e o **foco tem de se ver**. `*:focus { outline: none }` é dos erros mais comuns e mais graves; usa `:focus-visible` para estilizar em vez de esconder.
- **Contraste**: texto normal com pelo menos 4,5:1 em relação ao fundo (3:1 no texto grande). O cinzento claro "elegante" quase sempre falha.
- **Estrutura**: `lang` no `<html>` (o leitor de ecrã escolhe a voz), títulos por ordem (`h1`, `h2`, sem saltar para `h4`), e marcos (`<header>`, `<main>`, `<nav>`) para quem navega por regiões.
- **Mudanças dinâmicas**: o que aparece sem recarregar a página (uma mensagem "guardado", um erro) tem de ser anunciado, com uma região viva (`role="status"` ou `aria-live="polite"`).
- **Diálogos**: o `<dialog>` com `showModal()` já faz o difícil: o resto da página fica inerte, o foco entra no diálogo, o Escape fecha, e o foco volta para quem o abriu.

## 7. Testar a acessibilidade

- **Automaticamente**, com o **axe** (o `@axe-core/playwright` nos testes, ou a extensão no browser, ou o Lighthouse): apanha a parte mecânica (falta de `alt`, de etiquetas, contraste, ARIA mal usado). As ferramentas automáticas apanham só cerca de um terço dos problemas.
- **Com o teclado**: larga o rato e usa a aplicação só com Tab, Shift+Tab, Enter, Espaço, Escape e as setas. Vê-se sempre onde está o foco? A ordem faz sentido? Fica-se preso em algum lado?
- **Com um leitor de ecrã**: o NVDA (Windows, gratuito), o VoiceOver (macOS e iOS, incluído), o TalkBack (Android), o Orca (Linux). Experimenta navegar só por títulos e por marcos.
- **Com zoom a 200%** e com o texto maior, e com `prefers-reduced-motion` (sem animações para quem as desliga).
- E, quando possível, **com pessoas** que usam tecnologias de apoio no dia a dia.

---

## Prática: escreve tu

Quatro páginas com problemas para corrigir, testadas num Chrome a sério pelo Playwright: uma página inacessível (o axe e o teclado verificam), um "modal" feito com uma `<div>` para refazer com o `<dialog>` nativo, uma página que carrega devagar e salta (medidos a primeira pintura e o CLS, com a rede atrasada de propósito), e uma tarefa longa que bloqueia a página (medidas as tarefas longas e o atraso de um clique real).

**Ficheiros:** `pratica/56-performance-e-acessibilidade/` (`p1-acessivel/index.html`, `p2-modal/index.html` e `modal.js`, `p3-carregamento/index.html`, `p4-tarefa-longa/processar.js`)

**Verificar:** `npm run verificar 56` (dentro de `pratica/`). Só um exercício: `npm run verificar 56 p1` (ou `p2`, `p3`, `p4`). Usa o Google Chrome que tens instalado, como o módulo 09. Para veres as páginas: `node 56-performance-e-acessibilidade/servidor.mjs 5182` e abre `http://localhost:5182/p1-acessivel/`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Uma página acessível (≈25 min)

**Ficheiro:** `p1-acessivel/index.html`

Uma imagem sem `alt` num link, campos só com `placeholder`, um botão que é uma `<div>`, texto com pouco contraste, títulos fora de ordem, sem `lang`, sem marcos, e o foco escondido. Corrige até o axe não encontrar nada e o teste com o teclado passar.

**Sintaxe que vais praticar:** `<label for>`, `<button type="submit">`, `<main>`, `alt` num link com imagem, `:focus-visible`, contraste de cores.

<details>
<summary>Pista</summary>

Corre o teste do axe primeiro: a mensagem lista cada regra que falha (`image-alt`, `label`, `color-contrast`, `heading-order`, `region`...). Corrige uma de cada vez. Para o contraste, um cinzento de `#595959` sobre branco tem 7:1; o `#aaa` tem 2,3:1. A imagem dentro do link é o nome do link: o `alt` deve dizer para onde ele vai.
</details>

<details>
<summary>Solução de referência</summary>

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>As minhas tarefas</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
      header { display: flex; align-items: center; gap: 0.5rem; }
      label { display: block; margin-top: 0.75rem; }
      .dica { color: #595959; }
      button { background: #1d4ed8; color: #fff; padding: 0.5rem 1rem; border: 0; border-radius: 4px; margin-top: 0.75rem; }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <header>
      <a href="/"><img src="logo.svg" alt="Gestor de tarefas: início" width="32" height="32" /></a>
    </header>
    <main>
      <h1>As minhas tarefas</h1>
      <h2>Nova tarefa</h2>
      <form id="nova">
        <label for="titulo">Título</label>
        <input id="titulo" name="titulo" required />
        <label for="prioridade">Prioridade</label>
        <select id="prioridade" name="prioridade">
          <option>Alta</option>
          <option selected>Normal</option>
          <option>Baixa</option>
        </select>
        <button type="submit">Criar</button>
      </form>
      <p class="dica">Prima Enter no título para criar.</p>
      <h2>Lista</h2>
      <ul id="lista"></ul>
    </main>
    <script>
      const form = document.getElementById('nova');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const li = document.createElement('li');
        li.textContent = `${form.titulo.value} (${form.prioridade.value})`;
        document.getElementById('lista').append(li);
        form.reset();
        form.titulo.focus();
      });
    </script>
  </body>
</html>
```
</details>

### P2 · Um diálogo acessível (≈25 min)

**Ficheiros:** `p2-modal/index.html` e `p2-modal/modal.js`

Troca a `<div>` por um `<dialog>` aberto com `showModal()`, com o foco no botão seguro, o Escape a fechar, o foco a voltar a quem abriu, e o resultado anunciado numa região viva.

**Sintaxe que vais praticar:** `<dialog>`, `showModal()`, `<form method="dialog">` e `returnValue`, o evento `close`, `autofocus`, `aria-labelledby`, `role="status"`.

<details>
<summary>Pista</summary>

Quase tudo vem de graça com o `<dialog>`: põe os botões dentro de um `<form method="dialog">`, cada um com um `value`; ao clicar, o diálogo fecha e `dialogo.returnValue` fica com esse `value`. O Escape fecha com o `returnValue` que lá estiver, por isso limpa-o depois de cada fecho. Um único *listener* no evento `close` trata todos os casos.
</details>

<details>
<summary>Solução de referência</summary>

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Apagar tarefa</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
      button { padding: 0.5rem 1rem; }
      dialog { border: 0; border-radius: 8px; padding: 1.5rem; max-width: 24rem; }
      dialog::backdrop { background: rgb(0 0 0 / 0.5); }
      .perigo { background: #b91c1c; color: #fff; border: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Tarefa: rever o PR</h1>
      <button id="abrir" type="button">Apagar tarefa</button>
      <p id="estado" role="status"></p>
    </main>
    <dialog id="confirmar" aria-labelledby="titulo-dialogo">
      <h2 id="titulo-dialogo">Apagar a tarefa?</h2>
      <p>Esta ação não se pode desfazer.</p>
      <form method="dialog">
        <button value="cancelar" autofocus>Cancelar</button>
        <button value="apagar" class="perigo">Apagar</button>
      </form>
    </dialog>
    <script type="module" src="modal.js"></script>
  </body>
</html>
```

```js
// P2 · Um diálogo de confirmação acessível, com o <dialog> nativo.
const abrir = document.getElementById('abrir');
const dialogo = document.getElementById('confirmar');
const estado = document.getElementById('estado');

// showModal(): abre como modal (o resto da página fica inerte, o Escape fecha, e o foco vai para
// o botão com autofocus). Ao fechar, o browser devolve o foco a quem o abriu.
abrir.addEventListener('click', () => dialogo.showModal());

// Um <form method="dialog"> fecha o diálogo e põe o value do botão em dialogo.returnValue.
// O Escape fecha com returnValue vazio.
dialogo.addEventListener('close', () => {
  estado.textContent = dialogo.returnValue === 'apagar' ? 'Tarefa apagada.' : 'Cancelado.';
  dialogo.returnValue = '';
});
```
</details>

### P3 · Carregar depressa e sem saltos (≈20 min)

**Ficheiro:** `p3-carregamento/index.html`

Os testes atrasam a analítica 1,5 s e a imagem de capa 0,6 s. Faz a primeira pintura acontecer antes de 1 s, o CLS ficar abaixo de 0,01, a imagem de capa ter prioridade, e a imagem do fundo só ser pedida quando se chega lá.

**Sintaxe que vais praticar:** `defer`, `width`/`height` em imagens, `fetchpriority="high"`, `loading="lazy"`.

<details>
<summary>Pista</summary>

São só atributos. Um script sem `defer` no `<head>` bloqueia a pintura até chegar. Uma imagem sem `width` e `height` ocupa 0 px até chegar, e depois empurra tudo para baixo; com eles (e o `height: auto` que já está no CSS), o browser reserva o espaço certo.
</details>

<details>
<summary>Solução de referência</summary>

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Workshop</title>
    <script src="analitica.js" defer></script>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 800px; color: #222; }
      img { max-width: 100%; height: auto; display: block; }
      .longo { height: 6000px; }
    </style>
  </head>
  <body>
    <main>
      <img src="img/capa.svg" alt="Capa do workshop" width="800" height="400" fetchpriority="high" />
      <h1>Bem-vindo ao workshop</h1>
      <p id="texto">Este texto deve aparecer depressa e não saltar quando a imagem chega.</p>
      <div class="longo"></div>
      <img src="img/rodape.svg" alt="" width="800" height="200" loading="lazy" />
      <p>© <span id="ano"></span></p>
    </main>
    <script src="app.js" defer></script>
  </body>
</html>
```
</details>

### P4 · Uma tarefa longa (≈20 min)

**Ficheiro:** `p4-tarefa-longa/processar.js`

Processar 300 itens (~600 ms de CPU) sem nenhuma tarefa com mais de 50 ms, para a página continuar a pintar o progresso e a responder a cliques.

**Sintaxe que vais praticar:** `performance.now()`, `scheduler.yield()` com uma alternativa (`?.`), uma `Promise` à volta de `setTimeout(r, 0)`, `await` dentro de um `for`.

<details>
<summary>Pista</summary>

Guarda o instante em que começou o bloco atual; depois de cada item, se já passaram mais de ~10 ms, chama o `aoProgresso`, cede a thread (`await ceder()`) e começa um bloco novo. Não cedas depois de cada item: ceder também tem um custo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Uma tarefa longa sem bloquear a página.

// trabalho(n): simula ~2 ms de CPU por item (não mexas nesta função).
export function trabalho(n) {
  const fim = performance.now() + 2;
  while (performance.now() < fim);
  return n * 2;
}

// Devolve o controlo ao browser (para ele pintar e responder a cliques) e continua depois.
// scheduler.yield() existe no Chrome; setTimeout(0) é a alternativa que funciona em todo o lado.
const ceder = () => (globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

// processarTudo(itens, aoProgresso) → Promise com a soma de trabalho(i) para todos os itens
//   Chama aoProgresso(feitos) de vez em quando (e no fim, com o total).
//   Nunca pode ocupar o browser mais de ~50 ms seguidos: processa em blocos e cede entre eles.
export async function processarTudo(itens, aoProgresso = () => {}) {
  let soma = 0;
  let inicioDoBloco = performance.now();
  for (let i = 0; i < itens.length; i++) {
    soma += trabalho(itens[i]);
    if (performance.now() - inicioDoBloco > 10) {
      aoProgresso(i + 1);
      await ceder();
      inicioDoBloco = performance.now();
    }
  }
  aoProgresso(itens.length);
  return soma;
}
```
</details>

## Experiências

1. **O Lighthouse ao frontend do workshop:** com a stack a correr, abre as ferramentas do Chrome, separador *Lighthouse*, modo "Mobile", e corre um relatório de desempenho e de acessibilidade. Quais são as três primeiras sugestões? Repete com o *build* de produção em vez do servidor de desenvolvimento do Vite.
2. **Só com o teclado:** usa o frontend do workshop sem rato durante 5 minutos: entrar, criar uma tarefa, marcá-la como feita, sair. Onde te perdeste?
3. **Um leitor de ecrã:** liga o leitor de ecrã do teu sistema (o Orca no Linux: `Super+Alt+S`; o VoiceOver no macOS: `Cmd+F5`) e navega pela página do P1 antes e depois da tua correção.
4. **O axe no frontend:** acrescenta um teste Playwright ao frontend do workshop com o `@axe-core/playwright`, em cada página principal, e corrige o que encontrar.
5. **Um Web Worker:** reescreve o P4 com um `new Worker('worker.js', { type: 'module' })` e `postMessage`, e compara: a thread principal fica completamente livre?

## Perguntas de pensamento crítico

1. Um colega diz que a acessibilidade "fica para o fim, quando houver tempo". Que argumentos tens, e porque é que deixar para o fim sai mais caro?
2. O Lighthouse dá 98 de desempenho ao teu site, mas os dados de terreno mostram um INP de 450 ms. Como é que isto é possível?
3. Porque é que `<div class="botao" onclick="...">` é pior do que `<button>`, se as duas parecem iguais e funcionam com o rato?

<details>
<summary>Respostas</summary>

1. É uma obrigação legal para muitos produtos (a Diretiva Europeia de Acessibilidade, desde 2025), uma parte grande dos utilizadores precisa dela, e melhora o produto para todos (teclado, legendas, contraste ao sol). Deixar para o fim sai mais caro porque os problemas ficam espalhados por todos os componentes (`div`s em vez de botões, cores sem contraste no *design system*, modais feitos à mão, fluxos que só funcionam com o rato), e corrigir isso depois é reescrever; feito desde o início, é quase sempre só usar o elemento HTML certo e testar com o axe no pipeline.
2. O Lighthouse mede uma carga da página num laboratório, sem interações reais (o INP não é medido num carregamento) e com uma máquina e uma rede fixas. O INP do terreno vem dos utilizadores reais, a clicar em coisas que o Lighthouse nunca clicou (filtros, formulários, listas grandes), em telemóveis mais lentos, e muitas vezes com scripts de terceiros (analítica, anúncios, chat) que ocupam a thread principal. É preciso olhar para os dados de terreno, descobrir as interações lentas (a biblioteca `web-vitals` diz o elemento), e reproduzir com o perfil de desempenho do Chrome com a CPU abrandada.
3. Porque o `<button>` traz de graça o que a `<div>` não tem: recebe o foco com Tab, ativa com Enter e Espaço, é anunciado como "botão" pelos leitores de ecrã, participa nos formulários (submete), e respeita o estado `disabled`. Para a `<div>` fazer o mesmo era preciso `tabindex="0"`, `role="button"`, tratar as teclas à mão, e mesmo assim falhariam detalhes. Quem usa teclado ou leitor de ecrã simplesmente não consegue usar a versão com `<div>`.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 56`.

**1.** O que mede o CLS (Cumulative Layout Shift)?

- a) O tempo até à primeira pintura
- b) Quanto o conteúdo salta de sítio enquanto a página carrega
- c) O atraso de resposta a um clique
- d) O tamanho do JavaScript

<details><summary>Resposta</summary>

**b) Quanto o conteúdo salta de sítio enquanto a página carrega** — A causa mais comum são imagens sem width e height.

</details>

**2.** Qual é o efeito de <script src="x.js" defer> no <head>?

- a) Bloqueia a página até o script chegar
- b) Descarrega em paralelo e corre depois de o HTML ser lido, por ordem
- c) Nunca corre
- d) Corre antes do HTML

<details><summary>Resposta</summary>

**b) Descarrega em paralelo e corre depois de o HTML ser lido, por ordem** — Sem defer (nem async nem type=module), o script bloqueia a pintura.

</details>

**3.** Como se chama uma tarefa na thread principal com mais de 50 ms (em português ou inglês)?

<details><summary>Resposta</summary>

**tarefa longa** — É a causa número um de um INP mau; parte-se o trabalho e cede-se a thread.

</details>

**4.** Porque é que o placeholder não substitui um <label>?

- a) Porque não é suportado pelos browsers
- b) Porque desaparece quando se escreve e não é um nome acessível fiável
- c) Porque é sempre cinzento
- d) Porque não se pode traduzir

<details><summary>Resposta</summary>

**b) Porque desaparece quando se escreve e não é um nome acessível fiável** — O campo precisa de uma etiqueta associada com for/id.

</details>

**5.** O que é que o <dialog> com showModal() faz por ti?

- a) Nada, é só estilo
- b) Torna o resto da página inerte, põe o foco no diálogo, fecha com Escape e devolve o foco a quem o abriu
- c) Envia o formulário para o servidor
- d) Impede o Escape

<details><summary>Resposta</summary>

**b) Torna o resto da página inerte, põe o foco no diálogo, fecha com Escape e devolve o foco a quem o abriu** — A primeira regra do ARIA: usa o elemento HTML que já faz isso.

</details>

<!-- quiz:end -->
