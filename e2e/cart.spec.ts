import { expect, test } from '@playwright/test'
import { addToCart, login } from './helpers'

const summary = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Resumo do pedido' })

test.beforeEach(async ({ page }) => {
  await addToCart(page, 'nft-1', 2) // visitante: carrinho guardado pelo X-Guest-Id
  await page.getByRole('link', { name: /^Carrinho/ }).click()
  await expect(summary(page)).toBeVisible()
})

test('o total vem da cotação da API (2 × 0.0875 + taxa)', async ({ page }) => {
  await expect(summary(page)).toContainText(/0[.,]1775/)
})

test('quantidade respeita o estoque e atualiza o total', async ({ page }) => {
  const qty = page.locator('input[id^="qty-nft-1-"]')
  await qty.fill('99')
  await qty.press('Enter')
  await expect(qty).toHaveValue('5') // limite do estoque Padrão

  await qty.fill('3')
  await qty.press('Enter')
  await expect(summary(page)).toContainText(/0[.,]265/) // 3 × 0.0875 + 0.0025
})

test('cupom PROMO10 aplica e remove', async ({ page }) => {
  await page.getByLabel('Cupom de desconto').fill('PROMO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Cupom PROMO10 aplicado')).toBeVisible()
  await expect(summary(page)).toContainText(/0[.,]16(0{0,4})(?!\d)/)

  await page.getByRole('button', { name: 'Remover cupom' }).click()
  await expect(page.getByLabel('Cupom de desconto')).toBeVisible()
  await expect(summary(page)).toContainText(/0[.,]1775/)
})

test('cupom expirado mostra erro e não aplica desconto', async ({ page }) => {
  await page.getByLabel('Cupom de desconto').fill('EXPIRED')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(summary(page).locator('[role="alert"]')).toBeVisible()
  await expect(page.getByText(/EXPIRED aplicado/)).toHaveCount(0)
})

test('remover o item esvazia o carrinho', async ({ page }) => {
  await page.getByRole('button', { name: /^Remover .* do carrinho/ }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('o carrinho persiste após refresh', async ({ page }) => {
  await page.reload()
  await expect(summary(page)).toContainText(/0[.,]1775/)
  await expect(page.getByRole('link', { name: 'Carrinho, 2 item(ns)' })).toBeVisible()
})

test('itens do visitante são mantidos ao entrar na conta', async ({ page }) => {
  await login(page, 'ana@example.com')
  // CORRIGIDO: o merge acontece depois do login; espera o contador refletir os itens
  await expect(page.getByRole('link', { name: 'Carrinho, 2 item(ns)' })).toBeVisible({
    timeout: 10_000,
  })
  await page.getByRole('link', { name: /^Carrinho/ }).click() // navegação interna, sem recarregar
  await expect(summary(page)).toContainText(/0[.,]1775/)
})