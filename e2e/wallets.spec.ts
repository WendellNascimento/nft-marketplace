import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

const NEW_ADDRESS = '0x' + 'b'.repeat(40)
const SEED_ADDRESS = '0x' + 'a'.repeat(40)

// CORRIGIDO: não depende do texto "Principal" (o nome da carteira do seed pode ser igual).
// Exatamente uma principal = só uma carteira SEM o botão "Tornar principal".
async function expectSinglePrimary(page: Page, total: number) {
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(total)
  await expect(page.getByRole('button', { name: 'Tornar principal' })).toHaveCount(total - 1)
}

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/wallets')
  await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  await expectSinglePrimary(page, 1)
})

test('validação do formulário de carteira', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar carteira' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Informe um nome para a carteira.')).toBeVisible()
  await expect(page.getByText(/Endereço inválido/)).toBeVisible()

  await page.getByLabel('Nome').fill('Teste')
  await page.getByLabel('Endereço').fill('0x123')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(/Endereço inválido/)).toBeVisible()
})

test('cadastrar carteira secundária e torná-la principal', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar carteira' }).click()
  await page.getByLabel('Nome').fill('Carteira Polygon')
  await page.getByLabel('Endereço').fill(NEW_ADDRESS)
  await page.getByLabel('Rede').selectOption('polygon')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('Carteira cadastrada.')).toBeVisible()
  await expect(page.getByText('Carteira Polygon').first()).toBeVisible()
  await expectSinglePrimary(page, 2) // a nova nasce secundária

  await page.getByRole('button', { name: 'Tornar principal' }).click()
  await expect(page.getByText(/agora é a carteira principal/)).toBeVisible()
  await expectSinglePrimary(page, 2) // continua uma só
})

test('endereço duplicado mostra o erro da API e mantém o formulário', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar carteira' }).click()
  await page.getByLabel('Nome').fill('Duplicada')
  await page.getByLabel('Endereço').fill(SEED_ADDRESS)
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('form [role="alert"]').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nova carteira' })).toBeVisible()
})

test('editar o nome persiste após refresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar' }).first().click()
  await page.getByLabel('Nome').fill('Carteira Renomeada')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Carteira atualizada.')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Carteira Renomeada')).toBeVisible()
})