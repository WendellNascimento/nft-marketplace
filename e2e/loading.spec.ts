import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('catálogo: skeleton em carregamento lento e depois o conteúdo', async ({ page }) => {
  await useScenario(page, 'slow')
  await page.goto('/')
  const section = page.getByRole('region', { name: 'Catálogo' })
  await expect(section).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible({ timeout: 20_000 })
  await expect(section).toHaveAttribute('aria-busy', 'false')
})

test('catálogo: falha 500 mostra erro e "Tentar novamente" recupera', async ({ page }) => {
  await useScenario(page, 'server-error')
  await page.goto('/')
  // o app tenta de novo (até 2x) antes de mostrar o erro
  await expect(page.getByText('Não foi possível carregar o catálogo.')).toBeVisible({ timeout: 20_000 })

  // CORRIGIDO: troca o cenário direto no localStorage, sem recarregar a página
  await page.evaluate(() => localStorage.setItem('mock-scenario', 'default'))
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
})

test('detalhe: sem conteúdo durante o carregamento lento, depois aparece', async ({ page }) => {
  await useScenario(page, 'slow')
  await page.goto('/nft/nft-1')
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeVisible({
    timeout: 20_000,
  })
})