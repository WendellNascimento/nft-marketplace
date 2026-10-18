import { expect, test, type Page } from '@playwright/test'
import { login, mock, PASSWORD, sessionUser } from './helpers'

async function register(page: Page, name: string, email: string) {
  await page.goto('/register')
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASSWORD)
  // a tela tem confirmação de senha
  const confirm = page.getByRole('textbox', { name: 'Confirmar senha' })
  await confirm.fill(PASSWORD)
  await confirm.press('Enter')
}

test('cadastro: e-mail repetido é recusado', async ({ page }) => {
  await register(page, 'Ana Clone', 'ana@example.com')
  await expect(page.getByText('Este e-mail já está cadastrado.').first()).toBeVisible()
})

test('cadastro e login de um usuário novo', async ({ page }) => {
  await register(page, 'Novo Usuário', 'novo@example.com')
  // espera o cadastro terminar (o app vai ao /login) antes de navegar
  await expect(page).toHaveURL(/\/login/)
  await login(page, 'novo@example.com')
  expect((await sessionUser(page))?.name).toBe('Novo Usuário')
})

test('login com senha errada não cria sessão', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('ana@example.com')
  const field = page.getByRole('textbox', { name: 'Senha', exact: true })
  await field.fill('Errada@123')
  await field.press('Enter')
  await expect(page.getByText('E-mail ou senha inválidos.').first()).toBeVisible()
  expect(await sessionUser(page)).toBeNull()
})

test('rota protegida redireciona ao login e volta depois de entrar', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('E-mail').fill('ana@example.com')
  const field = page.getByRole('textbox', { name: 'Senha', exact: true })
  await field.fill(PASSWORD)
  await field.press('Enter')
  await expect(page).toHaveURL(/\/profile/)
})

test('logout e troca de usuário não herdam dados', async ({ page }) => {
  await login(page, 'ana@example.com')
  await expect(page.getByText('Olá, Ana')).toBeVisible() // CORRIGIDO: espera a navegação do login
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect.poll(() => sessionUser(page)).toBeNull()

  await login(page, 'bruno@example.com')
  await page.goto('/profile')
  await expect(page.getByLabel('E-mail')).toHaveValue('bruno@example.com')
})

test('sessão expirada durante a navegação leva ao login com aviso', async ({ page }) => {
  await login(page)
  await expect(page.getByText('Olá, Ana')).toBeVisible() // CORRIGIDO: espera a navegação do login
  await mock.expireSession(page)
  await page.getByRole('link', { name: 'Carteiras' }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    await expect(page.getByText(/expir/i).first()).toBeVisible()
})