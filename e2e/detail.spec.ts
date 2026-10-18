import { expect, test } from '@playwright/test'

test('detalhe por acesso direto: edições e limite de quantidade', async ({ page }) => {
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('radio')).toHaveCount(2)
  await expect(page.getByText('Máximo disponível: 5')).toBeVisible()

  const qty = page.locator('#qty')
  await qty.fill('99')
  await expect(qty).toHaveValue('5') // nunca passa do estoque
  await qty.fill('0')
  await expect(qty).toHaveValue('1')
})

test('NFT inexistente mostra 404 e volta ao catálogo', async ({ page }) => {
  await page.goto('/nft/nft-999')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('edições esgotadas bloqueiam a compra', async ({ page }) => {
  // nft-35: as duas edições esgotadas (35 é múltiplo de 7 e de 5)
  await page.goto('/nft/nft-35')
  await expect(page.getByText('Edição indisponível no momento.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Comprar agora' })).toBeDisabled()
})