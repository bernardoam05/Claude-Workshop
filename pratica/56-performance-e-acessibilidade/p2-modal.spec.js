import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('P2 · um diálogo acessível', () => {
  test.beforeEach(({ page }) => page.goto('/p2-modal/'));

  test('abre como modal, com o foco no botão seguro', async ({ page }) => {
    await page.getByRole('button', { name: 'Apagar tarefa' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Apagar a tarefa?' });
    await expect(dialogo).toBeVisible();
    expect(await dialogo.evaluate((d) => d.matches(':modal'))).toBe(true);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  });

  test('o Escape fecha, anuncia, e devolve o foco a quem abriu', async ({ page }) => {
    const abrir = page.getByRole('button', { name: 'Apagar tarefa' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(abrir).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Cancelado.');
  });

  test('confirmar apaga', async ({ page }) => {
    await page.getByRole('button', { name: 'Apagar tarefa' }).click();
    await page.getByRole('button', { name: 'Apagar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('status')).toHaveText('Tarefa apagada.');
  });

  test('cancelar depois de um Escape não é confundido com apagar', async ({ page }) => {
    const abrir = page.getByRole('button', { name: 'Apagar tarefa' });
    await abrir.click();
    await page.getByRole('button', { name: 'Apagar', exact: true }).click();
    await abrir.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('status')).toHaveText('Cancelado.');
  });

  test('o axe não encontra problemas, com o diálogo aberto', async ({ page }) => {
    await page.getByRole('button', { name: 'Apagar tarefa' }).click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
