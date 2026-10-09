import { expect, test } from '@playwright/test';

// Seletores por PAPEL e TEXTO (getByRole, getByPlaceholder), como um utilizador vê a página.
// Evitamos classes CSS: mudam com o design e partem os testes sem que nada esteja errado.

test('conta local: registar, criar tarefa, concluir e ver o worker processar', async ({ page }) => {
  const email = `e2e-${Date.now()}@teste.pt`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Não tenho conta' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Password/).fill('password-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await page.getByLabel('Título da tarefa').fill('Tarefa criada pelo Playwright');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Tarefa criada pelo Playwright')).toBeVisible();

  // A checkbox é CONTROLADA: só fica marcada depois de a API responder e a lista ser recarregada.
  // check() exige mudança imediata e falharia. click() + toBeChecked() espera pelo resultado real.
  const checkbox = page.getByRole('checkbox', { name: 'Tarefa criada pelo Playwright' });
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  // Consistência eventual: o contador só sobe quando o worker processar o evento.
  // toHaveText ESPERA (até ao timeout) que a condição se verifique. Nunca usar sleep fixo.
  const processed = page.locator('.stats div', { hasText: 'processadas pelo worker' }).locator('strong');
  await expect(processed).toHaveText('1', { timeout: 15_000 });
});

test('sem sessão, a app mostra o ecrã de login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('Keycloak: login no Keycloak (PKCE), voltar à app e criar uma tarefa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com Keycloak' }).click();

  // Agora estamos NO KEYCLOAK (outro domínio/porta). A nossa app nunca vê esta password.
  await expect(page).toHaveURL(/localhost:8180\/realms\/workshop/);
  await page.locator('#username').fill('alice');
  await page.locator('#password').fill('alice-password');
  await page.locator('#kc-login').click();

  // De volta à app, já autenticados. O URL não pode ficar com o ?code= (é de uso único).
  await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
  expect(page.url()).not.toContain('code=');

  const title = `Tarefa Keycloak ${Date.now()}`;
  await page.getByLabel('Título da tarefa').fill(title);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText(title)).toBeVisible();

  // Logout termina também a sessão no Keycloak: um novo login tem de pedir a password outra vez.
  await page.getByRole('button', { name: 'Terminar sessão' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar com Keycloak' }).click();
  await expect(page.locator('#password')).toBeVisible();
});
