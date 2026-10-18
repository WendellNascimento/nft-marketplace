import { expect, test } from '@playwright/test'
import { PASSWORD, sessionUser } from './helpers'

test('login: erro associado ao campo e fluxo só com teclado', async ({ page }) => {
  await page.goto('/login')
  const email = page.getByLabel('E-mail')
  const password = page.getByRole('textbox', { name: 'Senha', exact: true })

  await email.press('Enter') // envia vazio
  await expect(email).toHaveAttribute('aria-invalid', 'true')

  await email.fill('ana@example.com')
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()

  // foco visível: anel (box-shadow) ou outline
  const visible = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element)
    return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
  })
  expect(visible).toBe(true)

  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')
  await expect.poll(() => sessionUser(page)).not.toBeNull()
})

for (const path of ['/', '/login', '/register', '/cart']) {
  test(`sem rolagem horizontal em ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}