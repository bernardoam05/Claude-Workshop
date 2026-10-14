import { expect, test } from '@playwright/test';
import { capturar, estilo, luminancia } from './ajudas.js';

const PAGINA = '/p3-cartao/';
const DESKTOP = { width: 1024, height: 900 };
const TELEMOVEL = { width: 375, height: 900 };
const MUTED = 'rgb(107, 114, 128)';
const SURFACE = 'rgb(255, 255, 255)';

const cartao = (page, n) => page.locator('article').nth(n);
const caixas = async (locator) => Promise.all((await locator.all()).map((l) => l.boundingBox()));

test.describe('P3 · TaskGrid', () => {
  test('duas colunas a partir de 768px, uma no telemóvel, 16px de intervalo', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(PAGINA);
    const [a, b] = await caixas(page.locator('article'));
    expect(Math.abs(a.y - b.y), 'no computador, os dois primeiros cartões ficam lado a lado').toBeLessThan(2);
    expect(Math.round(b.x - (a.x + a.width)), 'intervalo entre colunas').toBe(16);

    await page.setViewportSize(TELEMOVEL);
    const noTelemovel = await caixas(page.locator('article'));
    expect(new Set(noTelemovel.map((c) => Math.round(c.x))).size, 'no telemóvel, uma só coluna').toBe(1);
  });
});

test.describe('P3 · TaskCard', () => {
  test('cartão: superfície, borda, cantos de 12px, sombra e 16px de espaço interior', async ({ page }) => {
    await page.goto(PAGINA);
    const c = cartao(page, 0);
    expect(await estilo(c, 'backgroundColor')).toBe(SURFACE);
    expect(await estilo(c, 'borderTopWidth')).toBe('1px');
    expect(await estilo(c, 'borderTopLeftRadius')).toBe('12px');
    expect(await estilo(c, 'boxShadow')).not.toBe('none');
    expect(await estilo(c, 'paddingTop')).toBe('16px');
  });

  test('título: em destaque, e um título enorme é cortado com "…" sem rebentar o cartão', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(PAGINA);
    const titulo = cartao(page, 1).locator('h3');
    expect(Number(await estilo(titulo, 'fontWeight'))).toBeGreaterThanOrEqual(600);
    expect(await estilo(titulo, 'textOverflow')).toBe('ellipsis');
    expect(await estilo(titulo, 'whiteSpace')).toBe('nowrap');
    const cortado = await titulo.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(cortado, 'o título comprido devia estar cortado').toBe(true);
    const transborda = await cartao(page, 1).evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(transborda, 'o conteúdo não pode sair do cartão (pista: min-w-0)').toBe(false);
  });

  test('tarefa feita: título riscado e em cor suave', async ({ page }) => {
    await page.goto(PAGINA);
    const titulo = cartao(page, 2).locator('h3');
    expect(await estilo(titulo, 'textDecorationLine')).toContain('line-through');
    expect(await estilo(titulo, 'color')).toBe(MUTED);
  });

  test('prazo no formato dd/mm, em letra pequena e cor suave; sem prazo, não aparece nada', async ({ page }) => {
    await page.goto(PAGINA);
    const prazo = cartao(page, 0).getByText('Prazo: 20/10');
    await expect(prazo).toBeVisible();
    expect(await estilo(prazo, 'color')).toBe(MUTED);
    expect(parseFloat(await estilo(prazo, 'fontSize'))).toBeLessThanOrEqual(14);
    await expect(cartao(page, 3).getByText(/Prazo/)).toHaveCount(0);
  });

  test('botões pequenos (32px): "Concluir" secundário e "Apagar" de perigo', async ({ page }) => {
    await page.goto(PAGINA);
    const concluir = cartao(page, 0).getByRole('button', { name: 'Concluir' });
    const apagar = cartao(page, 0).getByRole('button', { name: /Apagar/ });
    expect(Math.round((await concluir.boundingBox()).height)).toBe(32);
    expect(await estilo(concluir, 'backgroundColor')).toBe(SURFACE);
    expect(await estilo(apagar, 'backgroundColor')).toBe('rgb(220, 38, 38)');
  });

  test('no computador, os botões ficam à direita do texto; no telemóvel, por baixo', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(PAGINA);
    let titulo = await cartao(page, 0).locator('h3').boundingBox();
    let botao = await cartao(page, 0).getByRole('button', { name: 'Concluir' }).boundingBox();
    expect(botao.x, 'no computador, à direita').toBeGreaterThan(titulo.x + titulo.width);
    expect(botao.y, 'no computador, na mesma faixa').toBeLessThan(titulo.y + titulo.height + 24);

    await page.setViewportSize(TELEMOVEL);
    titulo = await cartao(page, 0).locator('h3').boundingBox();
    botao = await cartao(page, 0).getByRole('button', { name: 'Concluir' }).boundingBox();
    expect(botao.y, 'no telemóvel, os botões passam para baixo do texto').toBeGreaterThan(titulo.y + titulo.height);
  });

  test('os estilos seguem o estado: concluir risca o título', async ({ page }) => {
    await page.goto(PAGINA);
    await cartao(page, 0).getByRole('button', { name: 'Concluir' }).click();
    expect(await estilo(cartao(page, 0).locator('h3'), 'textDecorationLine')).toContain('line-through');
    await expect(cartao(page, 0).getByRole('button', { name: 'Reabrir' })).toBeVisible();
  });

  test('modo escuro: os cartões ficam escuros (usa os tokens, não cores fixas)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PAGINA);
    const fundo = await estilo(cartao(page, 0), 'backgroundColor');
    expect(fundo, 'o cartão precisa de um fundo próprio (bg-surface)').not.toBe('rgba(0, 0, 0, 0)');
    expect(luminancia(fundo)).toBeLessThan(0.15);
    expect(luminancia(await estilo(cartao(page, 0).locator('h3'), 'color'))).toBeGreaterThan(0.6);
  });

  test('telemóvel: nada sai para os lados', async ({ page }) => {
    await page.setViewportSize(TELEMOVEL);
    await page.goto(PAGINA);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(TELEMOVEL.width);
  });
});

test('capturas de ecrã (vê-as em pratica/09-estilos-css/capturas/)', async ({ page }) => {
  for (const [nome, viewport] of [['telemovel', TELEMOVEL], ['computador', DESKTOP]]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(PAGINA);
    await capturar(page, `p3-${nome}-claro`);
    await page.emulateMedia({ colorScheme: 'dark' });
    await capturar(page, `p3-${nome}-escuro`);
  }
});
