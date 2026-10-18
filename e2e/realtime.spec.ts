import { expect, test } from '@playwright/test'
import { addToCart, login, mock } from './helpers'
import { connectWallet, openCheckout, ordersInDb } from './flows'

test('preço muda via Socket.IO no checkout e exige aceitar a nova cotação', async ({ page }) => {
  await openCheckout(page)
  await connectWallet(page)
  const confirm = page.getByRole('button', { name: 'Confirmar pedido' })
  await expect(confirm).toBeEnabled()

  // o preço da edição Padrão do nft-1 passa de 0.0875 para 0.2
  await mock.changeNft(page, 'nft-1', { price: '0.200000', editionId: '1-std' })

  await expect(page.getByText('Os valores mudaram.')).toBeVisible()
  await expect(confirm).toBeDisabled()

  await page.getByRole('button', { name: 'Aceitar nova cotação' }).click()
  await expect(page.getByText('0.4025 ETH')).toBeVisible() // 2 × 0.2 + taxa 0.0025
  await expect(confirm).toBeEnabled()

  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('0.4025 ETH')).toBeVisible()
})

test('eventos duplicados ou antigos não reaplicam efeitos', async ({ page }) => {
  await login(page)
  await addToCart(page, 'nft-1', 2)
  await page.getByRole('link', { name: /^Carrinho,/ }).click()
  await expect(page.getByText('0.1775 ETH')).toBeVisible()

  // evento novo (versão 2): o resumo atualiza
  await mock.changeNft(page, 'nft-1', { price: '0.200000', editionId: '1-std' })
  await expect(page.getByText('0.4025 ETH')).toBeVisible()

  // conta quantas vezes a cotação é buscada daqui para frente
  let quoteRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/quote')) quoteRequests++
  })

  const event = (id: string, version: number) => ({
    id,
    type: 'nft.updated',
    resourceId: 'nft-1',
    version,
    occurredAt: new Date().toISOString(),
    data: { name: 'Pixel Lands #1' },
  })

  await mock.emitRaw(page, 'nft.updated', event('evt-antigo', 1))
  await mock.emitRaw(page, 'nft.updated', event('evt-duplicado', 2))
  await page.waitForTimeout(1500)
  expect(quoteRequests).toBe(0) // nenhum dos dois foi aplicado

  // prova de que o listener continua vivo: um evento mais novo É aplicado
  await mock.emitRaw(page, 'nft.updated', event('evt-novo', 3))
  await expect.poll(() => quoteRequests).toBeGreaterThan(0)
})

test('pedido pendente sobrevive ao refresh e termina confirmado, sem nova compra', async ({
  page,
}) => {
  await openCheckout(page)
  await connectWallet(page)
  await page.getByRole('button', { name: 'Confirmar pedido' }).click()

  await expect(page).toHaveURL(/\/order\//)
  await expect(page.getByRole('heading', { name: 'Aguardando confirmação' })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible({
    timeout: 15_000,
  })
  expect(await ordersInDb(page)).toBe(1)
})