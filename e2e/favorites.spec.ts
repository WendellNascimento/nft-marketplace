import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

// primeiro coração do catálogo (o nome alterna entre "Adicionar..." e "Remover...")
const firstHeart = (page: Page) => page.getByRole('button', { name: /favoritos/ }).first()

async function waitCatalog(page: Page) {
  await expect(page.getByText(/NFTs encontrados/)).toBeVisible()
  await expect(firstHeart(page)).toBeVisible()
}

// CORRIGIDO: quantos favoritos o servidor falso já gravou (recarregar antes disso cancela a gravação)
const savedFavorites = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('mock-db-v1')
    if (!raw) return 0
    const favorites = JSON.parse(raw).favorites as Record<string, string[]>
    return Object.values(favorites).flat().length
  })

test('visitante que tenta favoritar é levado ao login', async ({ page }) => {
  await page.goto('/')
  await waitCatalog(page)
  await firstHeart(page).click()
  await expect(page).toHaveURL(/\/login/)
})

test('favorito marcado continua marcado depois do refresh', async ({ page }) => {
  await login(page)
  await waitCatalog(page)

  await firstHeart(page).click()
  await expect(firstHeart(page)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => savedFavorites(page)).toBeGreaterThan(0) // CORRIGIDO: espera gravar

  await page.reload()
  await waitCatalog(page)
  await expect(firstHeart(page)).toHaveAttribute('aria-pressed', 'true')
})

test('favoritos de um usuário não aparecem para outro', async ({ page }) => {
  await login(page, 'ana@example.com')
  await waitCatalog(page)
  await firstHeart(page).click()
  await expect(firstHeart(page)).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Sair' }).click()
  await login(page, 'bruno@example.com')
  await waitCatalog(page)
  await expect(firstHeart(page)).toHaveAttribute('aria-pressed', 'false')
})

test('falha ao salvar o favorito desfaz a marcação e avisa', async ({ page }) => {
  await login(page)
  await waitCatalog(page)

  // troca o cenário sem recarregar a página
  await page.evaluate(() => localStorage.setItem('mock-scenario', 'favorite-fail'))

  await firstHeart(page).click()
  await expect(page.getByText(/Não foi possível atualizar o favorito/).first()).toBeVisible()
  await expect(firstHeart(page)).toHaveAttribute('aria-pressed', 'false')
})