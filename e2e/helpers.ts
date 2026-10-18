import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Senha@123'

// formato do window.__mock (src/mocks/control.ts)
type MockApi = {
  reset(): void
  setScenario(scenario: string): void
  expireSession(): void
  changeNft(id: string, patch: { price?: string; available?: number; editionId?: string }): void
  emitRaw(event: string, payload: unknown): void
}
type MockWindow = { __mock: MockApi }
type NftPatch = Parameters<MockApi['changeNft']>[1]

// cada teste roda num contexto novo: localStorage vazio, então o seed é recriado
export async function login(page: Page, email = 'ana@example.com', password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  const field = page.getByRole('textbox', { name: 'Senha', exact: true })
  await field.fill(password)
  await field.press('Enter')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('session'))).not.toBeNull()
  await expect(page.getByText('Olá,')).toBeVisible() // NOVO: espera a navegação do login terminar
  // espera sair do /login (o Ola aparece antes da navegacao terminar)
  await expect(page).not.toHaveURL(/\/login/)
}

export const sessionUser = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('session')
    return raw ? (JSON.parse(raw).user as { name: string; email: string; avatarUrl: string | null }) : null
  })

// cenário fixo desde o primeiro carregamento (slow, server-error, payment-declined...)
export async function useScenario(page: Page, scenario: string) {
  await page.addInitScript((s) => localStorage.setItem('mock-scenario', s), scenario)
}

// o acesso a window.__mock fica DENTRO de cada callback (roda no navegador)
export const mock = {
  setScenario: (page: Page, scenario: string) =>
    page.evaluate((s) => (window as unknown as MockWindow).__mock.setScenario(s), scenario),

  expireSession: (page: Page) =>
    page.evaluate(() => (window as unknown as MockWindow).__mock.expireSession()),

  changeNft: (page: Page, id: string, patch: NftPatch) =>
    page.evaluate(
      ([i, p]) => (window as unknown as MockWindow).__mock.changeNft(i as string, p as NftPatch),
      [id, patch] as const,
    ),

  emitRaw: (page: Page, event: string, payload: unknown) =>
    page.evaluate(
      ([e, p]) => (window as unknown as MockWindow).__mock.emitRaw(e as string, p),
      [event, payload] as const,
    ),
}

// NOVO: coloca o NFT (edição Padrão) no carrinho pela tela de detalhe
export async function addToCart(page: Page, nftId = 'nft-1', quantity = 2) {
  await page.goto(`/nft/${nftId}`)
  await page.locator('#qty').fill(String(quantity))
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(page.getByRole('link', { name: `Carrinho, ${quantity} item(ns)` })).toBeVisible()
}

// NOVO: espera imagens e rede assentarem antes de tirar print
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => [...document.images].every((img) => img.complete))
}
