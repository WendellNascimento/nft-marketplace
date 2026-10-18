import { expect, test, type Page } from '@playwright/test'
import { useScenario } from './helpers'
import { connectWallet, openCheckout, ordersInDb } from './flows'

const confirmButton = (page: Page) => page.getByRole('button', { name: 'Confirmar pedido' })

test('compra completa: do carrinho ao recibo confirmado', async ({ page }) => {
  await openCheckout(page)
  await expect(page.getByText('0.1775 ETH')).toBeVisible()
  await expect(confirmButton(page)).toBeDisabled() // sem carteira conectada

  await connectWallet(page)
  await expect(confirmButton(page)).toBeEnabled()
  await confirmButton(page).click()

  await expect(page).toHaveURL(/\/order\//)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('0.1775 ETH')).toBeVisible()
  await expect(page.getByText(/0x[0-9a-f]{64}/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Carrinho, 0 item(ns)' })).toBeVisible()
})

test('carteira: conectar, desconectar e bloquear a confirmação', async ({ page }) => {
  await openCheckout(page)
  await expect(page.getByText('Carteira desconectada', { exact: true })).toBeVisible()

  await connectWallet(page)
  await page.getByRole('button', { name: 'Desconectar' }).click()
  await expect(page.getByText('Carteira desconectada', { exact: true })).toBeVisible()
  await expect(confirmButton(page)).toBeDisabled()
})

test('carteira recusa a conexão', async ({ page }) => {
  await useScenario(page, 'wallet-reject')
  await openCheckout(page)

  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(
    page.getByText('A conexão foi recusada pela carteira. Tente novamente.'),
  ).toBeVisible()
  await expect(confirmButton(page)).toBeDisabled()
})

test('pagamento recusado mantém os itens no carrinho', async ({ page }) => {
  await useScenario(page, 'payment-declined')
  await openCheckout(page)
  await connectWallet(page)
  await confirmButton(page).click()

  await expect(page.getByRole('heading', { name: 'Pedido recusado' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Seus itens continuam no carrinho.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Carrinho, 2 item(ns)' })).toBeVisible()
})

test('clique repetido em Confirmar cria um único pedido', async ({ page }) => {
  await openCheckout(page)
  await connectWallet(page)

  await confirmButton(page).dblclick()

  await expect(page).toHaveURL(/\/order\//)
  await expect.poll(() => ordersInDb(page)).toBe(1)
})

test('timeout após criar o pedido: tentar de novo recupera o MESMO pedido', async ({ page }) => {
  test.setTimeout(90_000)
  await useScenario(page, 'order-timeout')
  await openCheckout(page)
  await connectWallet(page)

  await confirmButton(page).click()
  // o servidor demora 12 s e o axios desiste em 8 s
  await expect(page.getByText(/Não recebemos resposta/)).toBeVisible({ timeout: 20_000 })

  // volta o servidor ao normal, sem recarregar a página, e tenta de novo
  await page.evaluate(() => localStorage.setItem('mock-scenario', 'default'))
  await page.getByRole('button', { name: 'Tentar novamente' }).click()

  await expect(page).toHaveURL(/\/order\//, { timeout: 15_000 })
  await expect.poll(() => ordersInDb(page)).toBe(1)
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({
    timeout: 15_000,
  })
})