import { expect, test, type Page } from '@playwright/test'

const countNfts = async (page: Page) => {
  const text = await page.getByText(/NFTs encontrados/).textContent()
  return Number(text?.match(/\d+/)?.[0])
}

test('filtros combinados, ordenação e preço atualizam a URL e a contagem', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  const all = await countNfts(page)

  // coleção: usa a 2ª opção do select (a 1ª é "Todas")
  const collection = page.getByLabel('Coleção')
  const value = await collection.locator('option').nth(1).getAttribute('value')
  await collection.selectOption(value!)
  await expect(page).toHaveURL(/collection=/)
  await expect.poll(() => countNfts(page)).toBeLessThan(all)

  await page.getByLabel('Ordenar por').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page).toHaveURL(/collection=/) // filtros se combinam

  await page.locator('#min').fill('0.05')
  await page.locator('#max').fill('0.1')
  await page.getByRole('button', { name: 'Aplicar' }).click()
    // CORRIGIDO: o router coloca aspas (%22) em strings que parecem número
  await expect(page).toHaveURL(/minPrice=(%22)?0\.05/)
  await expect(page).toHaveURL(/maxPrice=(%22)?0\.1/)
})

test('preço inválido mostra erro e não altera a URL', async ({ page }) => {
  await page.goto('/')
  await page.locator('#min').fill('1,5')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Use números como 0.05 (com ponto).')).toBeVisible()
  await expect(page).not.toHaveURL(/minPrice/)
})

test('mudar um filtro volta para a página 1', async ({ page }) => {
  await page.goto('/?page=2')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  await page.getByLabel('Ordenar por').selectOption('name')
  await expect(page).toHaveURL(/sort=name/)
  await expect(page).not.toHaveURL(/page=/)
})

test('busca com debounce, estado vazio e limpar filtros', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  await page.getByLabel('Buscar').fill('zzzz-nao-existe')
  await expect(page).toHaveURL(/q=zzzz/) // só depois dos 300 ms do debounce
  await expect(page.getByText('Nenhum NFT encontrado para esses filtros.')).toBeVisible()

  await page.getByRole('button', { name: 'Limpar filtros' }).first().click()
  await expect(page).not.toHaveURL(/q=/)
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
})

test('botão voltar do navegador restaura os filtros', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  await page.getByLabel('Ordenar por').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await page.getByLabel('Ordenar por').selectOption('name')
  await expect(page).toHaveURL(/sort=name/)

  await page.goBack()
  await expect(page).toHaveURL(/sort=price_asc/)
  await expect(page.getByLabel('Ordenar por')).toHaveValue('price_asc')
})