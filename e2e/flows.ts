import { expect, type Page } from '@playwright/test'
import { addToCart, login } from './helpers'

// Ana com nft-1 (Padrão) × 2 no carrinho, já na tela de pagamento
export async function openCheckout(page: Page, email = 'ana@example.com') {
  await login(page, email)
  await addToCart(page, 'nft-1', 2)
  await page.getByRole('link', { name: /^Carrinho,/ }).click()
  await page.getByRole('link', { name: 'Finalizar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
}

export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Carteira conectada', { exact: true })).toBeVisible()
}

// quantos pedidos existem no banco do mock (para provar que não houve compra duplicada)
export const ordersInDb = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('mock-db-v1')
    return raw ? (JSON.parse(raw).orders as unknown[]).length : 0
  })