# 09 · Estilos e CSS

**Objetivo:** perceber **porque** estilizar uma interface é um problema técnico a sério (não só "gosto estético"), que opções existem no mercado, e porque este projeto escolheu Tailwind CSS. No fim, és capaz de olhar para uma classe como `rounded-lg bg-accent px-4 py-2` e saber exatamente o que cada pedaço faz — sem adivinhar.

**Ficheiros para ler (por esta ordem):** `src/web/src/styles.css` → `src/web/vite.config.js` → `src/web/src/components/TaskForm.jsx` → `src/web/src/components/AuthForm.jsx`.

---

## 1. Porque isto costuma ficar para depois

É um padrão comum: constróis a lógica (módulo 08), ela funciona, e a parte de "deixar bonito" fica para o fim — e nunca mais chega, porque parece um poço sem fundo (que cor? que espaçamento? que fonte?). Isto acontece em qualquer stack (React, Flutter, HTML puro): a lógica tem certo/errado claro (o teste passa ou não), o visual não tem essa bússola.

A boa notícia: **estilizar bem não é talento artístico, é um conjunto pequeno de decisões repetidas** — espaçamento consistente, 2-3 cores com significado, hierarquia tipográfica clara. Este módulo não te ensina design; ensina a ferramenta que torna essas decisões rápidas de aplicar e difíceis de desalinhar sem reparares.

## 2. O que já existia: CSS puro com variáveis

Antes deste módulo, `src/web/src/styles.css` era CSS tradicional: uma classe por componente (`.task-form`, `.task-list`, `.auth`), com variáveis CSS (`--bg`, `--accent`, ...) para suportar modo escuro sem JavaScript:

```css
:root {
  --accent: #2563eb;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f1218; }
}
.task-form input {
  border: 1px solid var(--border);
  border-radius: 8px;
}
```

Isto funciona. O problema não é técnico, é de **escala e disciplina**: cada componente novo é uma classe nova, num ficheiro que só cresce. Nada impede duas pessoas (ou tu, em dias diferentes) de escreverem `border-radius: 8px` numa classe e `border-radius: 10px` noutra, sem perceberem — o ficheiro `.css` não avisa.

## 3. As abordagens que existem no mercado

| Abordagem | Como funciona | Exemplo real |
|---|---|---|
| **CSS puro / Sass** | Classes com nomes teus, regras à mão | O `styles.css` antigo deste projeto |
| **CSS Modules** | Como CSS puro, mas cada classe é renomeada automaticamente por ficheiro — acaba o conflito de nomes entre componentes | `Button.module.css` + `import styles from './Button.module.css'` |
| **CSS-in-JS** (styled-components, Emotion) | Escreves CSS dentro do `.jsx`, como template string; a biblioteca gera classes em runtime ou build | `const Button = styled.button\`...\`;` |
| **Utility-first** (Tailwind) | Classes pequenas e pré-feitas, compostas direto no JSX; não escreves CSS novo quase nunca | `className="rounded-lg bg-accent px-4"` |

Nenhuma destas é "a errada" — são trade-offs:

- **CSS puro/Modules**: zero dependências, mas disciplina manual para manter consistência.
- **CSS-in-JS**: cores/espaçamentos vivem em JavaScript (fácil de computar dinamicamente), mas custo de performance em runtime (ou complexidade de build) e é uma abordagem em declínio no mercado desde que o CSS nativo ganhou variáveis e `:has()`.
- **Utility-first**: consistência "de fábrica" (não escreves `8px`, escreves `rounded-lg`, que é sempre o mesmo valor em todo o projeto), mas o JSX fica visualmente mais denso.

## 4. Porque Tailwind, especificamente

Pelo mesmo critério do [módulo 14](14-competencias-mercado.md): o que mais aparece em ofertas de emprego e repositórios reais, hoje. Tailwind é, de longe, a opção utility-first dominante, e tornou-se também a mais usada em geral em projetos React/Next.js novos — não porque seja "melhor" num sentido absoluto, mas porque resolve bem o problema do passo 2 (consistência) sem runtime de JavaScript (ao contrário do CSS-in-JS).

## 5. Como funciona, por dentro

```js
// vite.config.js
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [tailwindcss(), react()],
});
```

Isto não é um plugin que "estiliza por ti" — é um plugin que **lê o teu código-fonte** (todos os `.jsx`), procura strings que parecem classes Tailwind (`rounded-lg`, `bg-accent`, `flex`), e gera **só essas** no CSS final. Se uma classe não aparece em nenhum ficheiro, não existe no CSS enviado ao browser. É por isto que não há um "ficheiro de classes" gigante: o CSS final deste projeto tem ~8 KB, não os megabytes que a biblioteca Tailwind pesa.

```css
/* styles.css */
@import "tailwindcss";

@theme {
  --color-accent: #2563eb;
  --color-danger: #dc2626;
}
```

`@theme` é o ponto onde este projeto deixa de usar as cores "de fábrica" do Tailwind (`blue-600`, `red-600`, ...) e define as suas próprias, com nomes que significam algo aqui (`accent`, `danger`). Cada entrada faz **duas coisas ao mesmo tempo**: cria uma variável CSS normal (`--color-accent`, usável em qualquer CSS) e regista as classes `bg-accent`, `text-accent`, `border-accent`, etc. Defines a cor **uma vez**; antes (CSS puro), também era uma vez — a diferença aparece no próximo ponto.

## 6. Walkthrough: `TaskForm.jsx`, classe a classe

```jsx
<form className="mb-4 flex gap-2" onSubmit={handleSubmit}>
```
`mb-4` = `margin-bottom: 1rem` (o `4` é uma escala fixa do Tailwind: `4` → `1rem`, `2` → `0.5rem`, sempre a mesma conversão em todo o projeto — é essa a consistência "de fábrica" do passo 3). `flex` = `display: flex`. `gap-2` = `gap: 0.5rem` entre os filhos directos. Três propriedades CSS, três classes, zero CSS novo escrito.

```jsx
<input
  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-text"
  ...
/>
```
`flex-1` = cresce para ocupar o espaço disponível dentro do `flex` do formulário. `rounded-lg` = `border-radius` de um valor fixo (maior que `rounded` sozinho, menor que `rounded-xl`). `border` = `border-width: 1px`; `border-border` = a COR do contorno é a variável `--color-border` (repara: `border-border` parece repetido, mas não é — o primeiro `border` liga a propriedade, o segundo escolhe a cor). `bg-surface` e `text-text` fazem o mesmo para fundo e texto. `px-3 py-2` = padding horizontal/vertical.

```jsx
<button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
  Adicionar
</button>
```
`bg-accent` usa a cor definida no `@theme` do passo 5 — se um dia mudares `--color-accent` num sítio só, este botão (e todos os outros com `bg-accent`/`text-accent`/`border-accent` no projeto) mudam juntos, sem procurares ficheiro a ficheiro. `font-medium` = `font-weight: 500`. `text-white` é uma cor "de fábrica" do próprio Tailwind (não precisa de estar no `@theme` — só as cores do **design do projeto** precisam de nome próprio).

## 7. Modo escuro sem nenhuma linha de JavaScript

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f1218;
    --color-surface: #181c24;
  }
}
```

As classes (`bg-bg`, `bg-surface`, ...) nunca mudam — elas só leem a variável. Sobrescrever a variável dentro do `@media` basta para toda a app mudar de tema, porque toda a gente (componentes velhos e novos) está a apontar para o mesmo sítio. Isto é o mesmo truque de antes do Tailwind (o `styles.css` original já fazia isto); o Tailwind só tornou mais difícil quebrar a consistência por acidente.

## 8. Quando NÃO vale a pena usar Tailwind

Pensamento crítico, não propaganda:

- **Protótipos muito pequenos ou de vida curta**: a curva de aprendizagem (saber os nomes das classes) não compensa para 3 divs.
- **Equipas de design que trabalham em Figma e exportam CSS**: por vezes é mais direto manter nomes de classe semânticos (`.card-header`) que mapeiam 1:1 para o design, e deixar o CSS-in-JS ou Modules tratar disso.
- **JSX muito denso**: uma linha com 10 classes utilitárias é mais difícil de ler de relance do que `className="card"`. A mitigação comum é extrair o padrão repetido para um componente (como já fazemos com `TaskList`, `TaskForm`), não para uma classe CSS nova.

---

## Experiências

1. **Muda uma cor no sítio certo:** troca `--color-accent` no `@theme` do `styles.css` para outra cor. Corre `npm run dev` em `src/web` e confirma que os botões "Adicionar", "Entrar" e o link de logout mudam todos juntos.
2. **Parte a consistência de propósito:** num componente, escreve `bg-[#2563eb]` (uma cor "arbitrária", fora do `@theme`) em vez de `bg-accent`. Funciona visualmente? O que perdeste ao fazer isto, que não aparece no browser?
3. **Mede o CSS final:** corre `npm run build` em `src/web` e abre `dist/assets/*.css`. Confirma que só lá estão classes que realmente usaste nos `.jsx` — não as milhares que o Tailwind "tem disponíveis".

## Perguntas de pensamento crítico

1. Porque é que `@theme` define a cor **uma vez** resolve um problema que CSS puro com variáveis (que também só define a cor uma vez) não resolve completamente?
2. O plugin do Tailwind lê os teus ficheiros `.jsx` à procura de classes. O que aconteceria ao CSS final se construísses o nome de uma classe dinamicamente, tipo `className={'bg-' + corVariavel}`, em vez de escrevê-la por extenso?
3. Dark mode aqui não tem nenhum botão nem `localStorage` — segue sempre a preferência do sistema operativo. Que vantagem e que desvantagem tem essa escolha, comparada com um interruptor manual na app?

<details><summary>Resposta</summary>

1. CSS puro com variáveis já resolve a parte de "definir uma vez" — mas não impede ninguém de escrever `border-radius: 8px` à mão numa classe nova, em vez de usar a variável de espaçamento. O Tailwind não torna isso impossível, mas torna o caminho fácil (`rounded-lg`) muito mais curto do que o caminho que ignora a convenção (escrever CSS novo do zero) — a consistência vem de reduzir o atrito do caminho certo, não de uma regra imposta.
2. O plugin do Tailwind não executa o teu JavaScript — ele lê o **texto** dos ficheiros à procura de strings que pareçam classes. `'bg-' + corVariavel` nunca aparece como texto completo (`bg-accent`, `bg-danger`) em nenhum ficheiro, por isso o Tailwind nunca gera essa classe no CSS final, e o elemento fica sem estilo nenhum em produção — mesmo que funcionasse perfeitamente em desenvolvimento, se por acaso a classe já tivesse sido gerada por outro sítio do código. É por isto que as classes se escrevem sempre por extenso.
3. Vantagem: zero código, zero estado para guardar, e respeita a escolha que o utilizador já fez a nível do sistema operativo (não lhe perguntas a mesma coisa duas vezes). Desvantagem: o utilizador não pode escolher um tema diferente do sistema só para esta app — se quiseres isso, precisas de guardar a escolha (ex.: `localStorage`) e aplicar uma classe no `<html>` em vez de depender só do `@media`.

</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 09`.

**1.** O que faz o plugin @tailwindcss/vite, exatamente?

- a) Escreve CSS automaticamente a partir de um desenho
- b) Lê os ficheiros .jsx à procura de strings que parecem classes Tailwind, e gera no CSS final só as que encontrar
- c) Converte todo o CSS do projeto em JavaScript
- d) Substitui o React por um motor de templates próprio

<details><summary>Resposta</summary>

**b) Lê os ficheiros .jsx à procura de strings que parecem classes Tailwind, e gera no CSS final só as que encontrar** — É uma leitura de texto, não de execução: classes construídas dinamicamente (ex. "bg-" + cor) não são detetadas.

</details>

**2.** No bloco @theme do styles.css, o que acontece quando defines --color-accent?

- a) Nada, é só um comentário
- b) Cria uma variável CSS normal E regista as classes que a usam (bg-accent, text-accent, border-accent)
- c) Só funciona dentro de ficheiros .css, nunca em .jsx
- d) Substitui a cor em todos os projetos Tailwind instalados na máquina

<details><summary>Resposta</summary>

**b) Cria uma variável CSS normal E regista as classes que a usam (bg-accent, text-accent, border-accent)** — É por isto que mudar a cor num sítio só muda todos os componentes que usam essas classes.

</details>

**3.** Como é que o modo escuro funciona neste projeto, sem nenhum botão nem JavaScript?

- a) O Tailwind deteta o tema do browser e troca as classes automaticamente
- b) Um @media (prefers-color-scheme: dark) sobrescreve as variáveis CSS; as classes (bg-bg, bg-surface) continuam iguais, só o valor que leem muda
- c) Há duas cópias do CSS, uma para cada tema, escolhidas pelo servidor
- d) Não é possível ter modo escuro sem JavaScript

<details><summary>Resposta</summary>

**b) Um @media (prefers-color-scheme: dark) sobrescreve as variáveis CSS; as classes (bg-bg, bg-surface) continuam iguais, só o valor que leem muda** — As classes utilitárias nunca mudam de nome — só a variável CSS que referenciam muda de valor dentro do @media.

</details>

**4.** Qual é a principal diferença entre a abordagem utility-first (Tailwind) e CSS Modules?

- a) Não há diferença nenhuma, são a mesma técnica com nomes diferentes
- b) CSS Modules continua a escreveres-te CSS à mão (só evita conflito de nomes entre ficheiros); Tailwind evita escrever CSS novo quase sempre, compondo classes já existentes
- c) CSS Modules só funciona em Vue, nunca em React
- d) Tailwind não permite nenhuma personalização de cores

<details><summary>Resposta</summary>

**b) CSS Modules continua a escreveres-te CSS à mão (só evita conflito de nomes entre ficheiros); Tailwind evita escrever CSS novo quase sempre, compondo classes já existentes** — CSS Modules resolve o problema de nomes de classe colidirem entre componentes; Tailwind resolve consistência evitando que escrevas valores novos (8px aqui, 10px lá) à mão.

</details>

**5.** Porque é que o ficheiro CSS final de produção (dist/assets/*.css) tem só uns KB, e não megabytes, apesar do Tailwind ter milhares de classes disponíveis?

- a) O Tailwind comprime o CSS com um algoritmo secreto
- b) O plugin só gera no CSS final as classes que encontrou realmente usadas no código-fonte (.jsx) — o resto nunca é escrito
- c) As classes não usadas são carregadas por um pedido HTTP separado
- d) O browser remove classes não usadas automaticamente

<details><summary>Resposta</summary>

**b) O plugin só gera no CSS final as classes que encontrou realmente usadas no código-fonte (.jsx) — o resto nunca é escrito** — É uma varredura em build-time do código-fonte, não uma biblioteca inteira enviada ao browser.

</details>

<!-- quiz:end -->
