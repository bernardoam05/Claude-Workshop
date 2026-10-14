import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { capturar, estilo, esperarTransicoes } from './ajudas.js';

const PAGINA = '/p2-componentes/';
// As cores dos tokens do app.css, como o browser as calcula.
const ACCENT = 'rgb(37, 99, 235)';
const DANGER = 'rgb(220, 38, 38)';
const SUCCESS = 'rgb(22, 163, 74)';
const SURFACE = 'rgb(255, 255, 255)';
const BORDER = 'rgb(226, 229, 234)';
const TEXT = 'rgb(29, 35, 48)';
const WHITE = 'rgb(255, 255, 255)';

test.describe('P2 · Button', () => {
  test('cada variante tem as cores dos tokens', async ({ page }) => {
    await page.goto(PAGINA);
    const primary = page.getByTestId('primary');
    expect(await estilo(primary, 'backgroundColor'), 'primary: fundo bg-accent').toBe(ACCENT);
    expect(await estilo(primary, 'color'), 'primary: texto branco').toBe(WHITE);

    const danger = page.getByTestId('danger');
    expect(await estilo(danger, 'backgroundColor'), 'danger: fundo bg-danger').toBe(DANGER);
    expect(await estilo(danger, 'color')).toBe(WHITE);

    const secondary = page.getByTestId('secondary');
    expect(await estilo(secondary, 'backgroundColor'), 'secondary: fundo bg-surface').toBe(SURFACE);
    expect(await estilo(secondary, 'color'), 'secondary: texto text-text').toBe(TEXT);
    expect(await estilo(secondary, 'borderTopWidth'), 'secondary: borda de 1px').toBe('1px');
    expect(await estilo(secondary, 'borderTopColor'), 'secondary: borda border-border').toBe(BORDER);
  });

  test('tamanhos: md com 40px de altura, sm com 32px e letra mais pequena', async ({ page }) => {
    await page.goto(PAGINA);
    const md = await page.getByTestId('primary').boundingBox();
    const sm = await page.getByTestId('small').boundingBox();
    expect(Math.round(md.height)).toBe(40);
    expect(Math.round(sm.height)).toBe(32);
    const letra = async (id) => parseFloat(await estilo(page.getByTestId(id), 'fontSize'));
    expect(await letra('small')).toBeLessThan(await letra('primary'));
  });

  test('cantos de 8px e letra em peso médio (500) ou mais', async ({ page }) => {
    await page.goto(PAGINA);
    const b = page.getByTestId('primary');
    expect(await estilo(b, 'borderTopLeftRadius')).toBe('8px');
    expect(Number(await estilo(b, 'fontWeight'))).toBeGreaterThanOrEqual(500);
  });

  test('é type="button" por omissão e passa os outros atributos (ex.: aria-label)', async ({ page }) => {
    await page.goto(PAGINA);
    // Um <button> dentro de um <form> é type="submit" por omissão: submete o formulário sem querer.
    await expect(page.getByTestId('primary')).toHaveAttribute('type', 'button');
    await expect(page.getByRole('button', { name: 'Fechar janela' })).toBeVisible();
  });

  test('o fundo muda ao passar o rato', async ({ page }) => {
    await page.goto(PAGINA);
    const b = page.getByTestId('primary');
    const antes = await estilo(b, 'backgroundColor');
    await b.hover();
    await esperarTransicoes(page);
    expect(await estilo(b, 'backgroundColor')).not.toBe(antes);
  });

  test('o contorno de foco aparece com o teclado, mas não com o rato (focus-visible)', async ({ page }) => {
    await page.goto(PAGINA);
    const primary = page.getByTestId('primary');
    await primary.click();
    expect(await estilo(primary, 'outlineStyle'), 'clicar com o rato não deve mostrar contorno').toBe('none');

    await page.keyboard.press('Tab'); // o foco passa para "Cancelar", agora pelo teclado
    const secondary = page.getByTestId('secondary');
    await expect(secondary).toBeFocused();
    expect(await estilo(secondary, 'outlineStyle'), 'com o teclado, o contorno tem de aparecer').not.toBe('none');
    expect(parseFloat(await estilo(secondary, 'outlineWidth'))).toBeGreaterThanOrEqual(2);
  });

  test('desativado: meio transparente e cursor "proibido"', async ({ page }) => {
    await page.goto(PAGINA);
    const b = page.getByTestId('disabled');
    expect(Number(await estilo(b, 'opacity'))).toBeLessThanOrEqual(0.6);
    expect(await estilo(b, 'cursor')).toBe('not-allowed');
  });
});

test.describe('P2 · Badge', () => {
  test('mostra o texto em português, com a cor de cada estado', async ({ page }) => {
    await page.goto(PAGINA);
    await expect(page.getByText('Por fazer', { exact: true })).toBeVisible();
    expect(await estilo(page.getByText('Feita', { exact: true }), 'color')).toBe(SUCCESS);
    expect(await estilo(page.getByText('Atrasada', { exact: true }), 'color')).toBe(DANGER);
  });

  test('é uma "pílula": cantos totalmente redondos e letra pequena', async ({ page }) => {
    await page.goto(PAGINA);
    const badge = page.getByText('Atrasada', { exact: true });
    const caixa = await badge.boundingBox();
    expect(parseFloat(await estilo(badge, 'borderTopLeftRadius'))).toBeGreaterThanOrEqual(caixa.height / 2);
    expect(parseFloat(await estilo(badge, 'fontSize'))).toBeLessThanOrEqual(13);
  });
});

test('nenhuma classe é construída com ${...} (o Tailwind não as encontraria)', () => {
  for (const ficheiro of ['Button.jsx', 'Badge.jsx']) {
    const codigo = readFileSync(new URL(`./p2-componentes/${ficheiro}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // sem comentários: lá podes falar do que quiseres
    const dinamica = codigo.match(/[a-z]-\$\{[^}]*\}/);
    expect(dinamica?.[0], `${ficheiro}: classe construída dinamicamente (secção 5 e pergunta 2 do módulo)`).toBeUndefined();
  }
});

test('captura de ecrã (vê-a em pratica/09-estilos-css/capturas/)', async ({ page }) => {
  await page.goto(PAGINA);
  await capturar(page, 'p2-claro');
  await page.emulateMedia({ colorScheme: 'dark' });
  await capturar(page, 'p2-escuro');
});
