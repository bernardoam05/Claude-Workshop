import { expect, test } from '@playwright/test';
import { capturar, corDaVariavel, estilo, esperarTransicoes, luminancia } from './ajudas.js';

const PAGINA = '/p1-css-puro/';
const DESKTOP = { width: 1280, height: 900 };
const TELEMOVEL = { width: 375, height: 800 };

test.describe('P1 · CSS puro', () => {
  test('cores: variáveis no :root, usadas pelo body, e um modo escuro', async ({ page }) => {
    await page.goto(PAGINA);
    for (const v of ['--cor-fundo', '--cor-superficie', '--cor-texto', '--cor-suave', '--cor-destaque', '--cor-borda']) {
      const valor = await page.evaluate((nome) => getComputedStyle(document.documentElement).getPropertyValue(nome), v);
      expect(valor.trim(), `a variável ${v} não está definida no :root`).not.toBe('');
    }
    const body = page.locator('body');
    expect(await estilo(body, 'backgroundColor'), 'o fundo do body tem de vir de var(--cor-fundo)').toBe(
      await corDaVariavel(page, '--cor-fundo'),
    );
    expect(luminancia(await estilo(body, 'backgroundColor')), 'em modo claro, o fundo deve ser claro').toBeGreaterThan(0.8);

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(luminancia(await estilo(body, 'backgroundColor')), 'em modo escuro, o fundo deve ser escuro').toBeLessThan(0.15);
    expect(luminancia(await estilo(body, 'color')), 'em modo escuro, o texto deve ser claro').toBeGreaterThan(0.6);
  });

  test('contentor: no máximo 960px, centrado, e 16px de margem lateral no telemóvel', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(PAGINA);
    const main = await page.locator('main').boundingBox();
    expect(main.width, 'o contentor não pode passar dos 960px').toBeLessThanOrEqual(961);
    expect(Math.abs(main.x - (DESKTOP.width - main.x - main.width)), 'o contentor tem de estar centrado').toBeLessThanOrEqual(2);

    await page.setViewportSize(TELEMOVEL);
    const h1 = await page.locator('h1').boundingBox();
    expect(Math.round(h1.x), 'no telemóvel, o texto deve começar a 16px da borda').toBe(16);
  });

  test('topo (≥ 640px): logo à esquerda, menu à direita, na mesma linha', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(PAGINA);
    const logo = await page.locator('.logo').boundingBox();
    const menu = await page.locator('.menu').boundingBox();
    const main = await page.locator('main h1').boundingBox();
    expect(Math.abs(logo.y + logo.height / 2 - (menu.y + menu.height / 2)), 'logo e menu centrados na vertical').toBeLessThanOrEqual(4);
    expect(Math.abs(logo.x - main.x), 'o logo alinha com o conteúdo, à esquerda').toBeLessThanOrEqual(2);
    expect(menu.x, 'o menu fica à direita').toBeGreaterThan(1024 / 2);

    const links = await page.locator('.menu a').all();
    const caixas = await Promise.all(links.map((l) => l.boundingBox()));
    expect(new Set(caixas.map((c) => Math.round(c.y))).size, 'os links do menu ficam lado a lado').toBe(1);
    expect(caixas[1].x - (caixas[0].x + caixas[0].width), 'espaço entre os links do menu').toBeGreaterThanOrEqual(12);
  });

  test('topo (< 640px): o menu passa para baixo do logo', async ({ page }) => {
    await page.setViewportSize(TELEMOVEL);
    await page.goto(PAGINA);
    const logo = await page.locator('.logo').boundingBox();
    const menu = await page.locator('.menu').boundingBox();
    expect(menu.y, 'no telemóvel, o menu tem de ficar por baixo do logo').toBeGreaterThanOrEqual(logo.y + logo.height);
  });

  test('cartões: grelha com 3 ou mais colunas no computador, 1 no telemóvel, 16px de intervalo', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(PAGINA);
    const ul = page.locator('.cartoes');
    expect(await estilo(ul, 'listStyleType'), 'a lista não deve ter marcadores').toBe('none');
    expect(await estilo(ul, 'paddingLeft'), 'a lista não deve ter o recuo por omissão').toBe('0px');

    const cartoes = await Promise.all((await page.locator('.cartao').all()).map((c) => c.boundingBox()));
    const naPrimeiraLinha = cartoes.filter((c) => Math.abs(c.y - cartoes[0].y) < 2);
    expect(naPrimeiraLinha.length, 'colunas na primeira linha, a 1024px').toBeGreaterThanOrEqual(3);
    expect(Math.round(cartoes[1].x - (cartoes[0].x + cartoes[0].width)), 'intervalo entre cartões').toBe(16);

    await page.setViewportSize(TELEMOVEL);
    const noTelemovel = await Promise.all((await page.locator('.cartao').all()).map((c) => c.boundingBox()));
    expect(new Set(noTelemovel.map((c) => Math.round(c.x))).size, 'no telemóvel, uma só coluna').toBe(1);
  });

  test('cartão: superfície, borda de 1px, cantos de 12px, 16px de espaço interior, e reação ao rato', async ({ page }) => {
    await page.goto(PAGINA);
    const cartao = page.locator('.cartao').first();
    expect(await estilo(cartao, 'backgroundColor')).toBe(await corDaVariavel(page, '--cor-superficie'));
    expect(await estilo(cartao, 'borderTopWidth')).toBe('1px');
    expect(await estilo(cartao, 'borderTopLeftRadius')).toBe('12px');
    expect(await estilo(cartao, 'paddingTop')).toBe('16px');

    await cartao.hover();
    await esperarTransicoes(page);
    expect(await estilo(cartao, 'transform'), 'ao passar o rato, o cartão deve mexer-se (transform)').not.toBe('none');
    expect(await estilo(cartao, 'boxShadow'), 'ao passar o rato, o cartão deve ganhar sombra').not.toBe('none');
  });

  test('rodapé: fica no fundo do ecrã mesmo com pouco conteúdo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.goto(PAGINA);
    const rodape = await page.locator('.rodape').boundingBox();
    expect(Math.round(rodape.y + rodape.height), 'o fim do rodapé tem de coincidir com o fim do ecrã').toBe(1600);
  });

  test('telemóvel: nada sai para os lados (sem scroll horizontal)', async ({ page }) => {
    await page.setViewportSize(TELEMOVEL);
    await page.goto(PAGINA);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(TELEMOVEL.width);
  });

  test('acessibilidade: o foco do teclado é visível nos links do menu', async ({ page }) => {
    await page.goto(PAGINA);
    await page.keyboard.press('Tab'); // logo
    await page.keyboard.press('Tab'); // "Hoje"
    const focado = page.locator(':focus');
    await expect(focado).toHaveText('Hoje');
    expect(await estilo(focado, 'outlineStyle'), 'o link focado precisa de um contorno visível').not.toBe('none');
    expect(parseFloat(await estilo(focado, 'outlineWidth'))).toBeGreaterThanOrEqual(2);
  });

  test('capturas de ecrã (vê-as em pratica/09-estilos-css/capturas/)', async ({ page }) => {
    for (const [nome, viewport] of [['telemovel', TELEMOVEL], ['computador', DESKTOP]]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(PAGINA);
      await capturar(page, `p1-${nome}-claro`);
      await page.emulateMedia({ colorScheme: 'dark' });
      await capturar(page, `p1-${nome}-escuro`);
    }
  });
});
