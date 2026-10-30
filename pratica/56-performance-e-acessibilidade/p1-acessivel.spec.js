import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('P1 · uma página acessível', () => {
  test.beforeEach(({ page }) => page.goto('/p1-acessivel/'));

  test('o axe não encontra problemas', async ({ page }) => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const resumo = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}×)`);
    expect(resumo).toEqual([]);
  });

  test('a página diz em que língua está', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', /^pt/);
  });

  test('os campos têm etiquetas e o botão é um botão', async ({ page }) => {
    await expect(page.getByLabel('Título')).toBeVisible();
    await expect(page.getByLabel('Prioridade')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar' })).toBeVisible();
  });

  test('dá para criar uma tarefa só com o teclado', async ({ page }) => {
    await page.keyboard.press('Tab'); // o link do logótipo
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Título')).toBeFocused();
    await page.keyboard.type('Rever PR');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Criar' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listitem')).toHaveText('Rever PR (Normal)');
  });
});
