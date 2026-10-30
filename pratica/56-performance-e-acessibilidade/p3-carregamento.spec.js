import { expect, test } from '@playwright/test';

const atrasar = (ms) => async (route) => {
  await new Promise((r) => setTimeout(r, ms));
  await route.continue();
};

test.describe('P3 · carregamento', () => {
  test('um script lento não atrasa a primeira pintura', async ({ page }) => {
    await page.route('**/analitica.js', atrasar(1500));
    await page.goto('/p3-carregamento/', { waitUntil: 'commit' });
    await expect(page.locator('#texto')).toBeVisible();
    const fcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          new PerformanceObserver((l) => {
            const e = l.getEntries().find((x) => x.name === 'first-contentful-paint');
            if (e) resolve(e.startTime);
          }).observe({ type: 'paint', buffered: true });
        }),
    );
    expect(fcp, `primeira pintura aos ${Math.round(fcp)} ms`).toBeLessThan(1000);
  });

  test('a imagem de capa não faz a página saltar (CLS)', async ({ page }) => {
    await page.route('**/img/capa.svg', atrasar(600));
    await page.goto('/p3-carregamento/');
    await page.waitForTimeout(200);
    const cls = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let total = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) total += e.value;
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(total), 100);
        }),
    );
    expect(cls, `CLS = ${cls.toFixed(3)}`).toBeLessThan(0.01);
  });

  test('a imagem de capa tem prioridade alta', async ({ page }) => {
    await page.goto('/p3-carregamento/');
    await expect(page.getByAltText('Capa do workshop')).toHaveAttribute('fetchpriority', 'high');
  });

  test('a imagem do fundo da página só é pedida quando se chega perto dela', async ({ page }) => {
    const pedidas = [];
    page.on('request', (r) => pedidas.push(new URL(r.url()).pathname));
    await page.goto('/p3-carregamento/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    expect(pedidas).not.toContain('/p3-carregamento/img/rodape.svg');
    await page.locator('#ano').scrollIntoViewIfNeeded();
    await expect.poll(() => pedidas).toContain('/p3-carregamento/img/rodape.svg');
  });

  test('os scripts não bloqueiam o HTML e continuam a funcionar', async ({ page }) => {
    await page.goto('/p3-carregamento/');
    const bloqueantes = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].filter((s) => !s.defer && !s.async && s.type !== 'module').map((s) => s.getAttribute('src')),
    );
    expect(bloqueantes).toEqual([]);
    await expect(page.locator('#ano')).toHaveText(String(new Date().getFullYear()));
    await expect.poll(() => page.evaluate(() => Boolean(window.analitica))).toBe(true);
  });
});
