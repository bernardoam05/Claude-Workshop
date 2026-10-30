import { expect, test } from '@playwright/test';

test.describe('P4 · uma tarefa longa', () => {
  test.beforeEach(({ page }) => page.goto('/p4-tarefa-longa/'));

  test('dá o resultado certo e mostra o progresso', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { processarTudo } = await import('/p4-tarefa-longa/processar.js');
      const progresso = [];
      const soma = await processarTudo([1, 2, 3, 4], (f) => progresso.push(f));
      return { soma, ultimo: progresso.at(-1) };
    });
    expect(r).toEqual({ soma: 20, ultimo: 4 });
  });

  test('nenhuma tarefa longa: o browser nunca fica ocupado mais de 50 ms seguidos', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { processarTudo } = await import('/p4-tarefa-longa/processar.js');
      const itens = Array.from({ length: 300 }, (_, i) => i);
      const longas = [];
      const obs = new PerformanceObserver((l) => longas.push(...l.getEntries().map((e) => e.duration)));
      obs.observe({ type: 'longtask' });
      await new Promise((r) => setTimeout(r, 50));
      const soma = await processarTudo(itens);
      await new Promise((r) => setTimeout(r, 50));
      obs.disconnect();
      return { soma, longas };
    });
    expect(r.soma).toBe(89700);
    expect(r.longas.map(Math.round), 'tarefas longas (em ms)').toEqual([]);
  });

  test('um clique durante o processamento tem resposta rápida', async ({ page }) => {
    // Um clique a sério (do rato) chega 50 ms depois de o processamento começar. O atraso é o
    // tempo entre o browser receber o clique (event.timeStamp) e a página o conseguir tratar:
    // é a primeira parte do INP. Com a página bloqueada, o clique espera pelo fim.
    await page.evaluate(() => {
      const outro = document.createElement('button');
      outro.id = 'outro';
      outro.textContent = 'Outro';
      outro.addEventListener('click', (e) => (window.atraso = performance.now() - e.timeStamp));
      document.body.append(outro);
    });
    const caixa = await page.locator('#outro').boundingBox();
    await page.evaluate(() => setTimeout(() => document.getElementById('processar').click(), 0));
    await page.waitForTimeout(50);
    await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    const atraso = await page.waitForFunction(() => window.atraso).then((h) => h.jsonValue());
    expect(atraso, `o clique esperou ${Math.round(atraso)} ms`).toBeLessThan(100);
    await expect(page.locator('#resultado')).toHaveText('Soma: 89700');
  });
});
