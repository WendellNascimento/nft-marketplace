import { expect, test } from '@playwright/test'
import { addToCart, settle } from './helpers'
import { openCheckout } from './flows'

test('visual: início', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
})

test('visual: detalhe', async ({ page }) => {
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
})

test('visual: carrinho', async ({ page }) => {
  await addToCart(page, 'nft-1', 2)
  await page.goto('/cart')
  await expect(page.getByRole('complementary', { name: 'Resumo do pedido' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
})

test('visual: pagamento', async ({ page }) => {
  await openCheckout(page)
  await settle(page)
  await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
})
