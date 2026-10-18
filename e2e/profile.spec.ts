/// <reference types="node" />
import { expect, test } from '@playwright/test'
import { login, PASSWORD, sessionUser } from './helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pKcAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/profile')
  // CORRIGIDO: não presume o nome do seed, só espera o perfil carregar
  await expect(page.getByRole('textbox', { name: 'Nome' })).not.toHaveValue('')
})

test('dados: validação local, e-mail duplicado e salvar com persistência', async ({ page }) => {
  const name = page.getByRole('textbox', { name: 'Nome' })
  const email = page.getByLabel('E-mail')
  const save = page.getByRole('button', { name: 'Salvar alterações' })

  await name.fill('   ')
  await email.fill('abc')
  await save.click()
  await expect(page.locator('#name-error')).toHaveText('Informe seu nome.')
  await expect(page.locator('#email-error')).toHaveText('Informe um e-mail válido.')

  await name.fill('Ana Souza')
  await email.fill('bruno@example.com')
  await save.click()
  await expect(page.locator('#email-error')).toHaveText('Este e-mail já está cadastrado.')

  await email.fill('ana@example.com')
  await save.click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  expect((await sessionUser(page))?.name).toBe('Ana Souza')

  await page.reload()
  await expect(name).toHaveValue('Ana Souza')
})

test('avatar: rejeita arquivo inválido, salva e remove', async ({ page }) => {
  const file = page.locator('#avatar')
  const preview = page.getByRole('img', { name: 'Sua foto de perfil' })

  await file.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.locator('#avatar-error')).toHaveText('Escolha um arquivo de imagem.')

  await file.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(204_801) })
  await expect(page.locator('#avatar-error')).toHaveText('A imagem é grande demais (máximo 200 KB).')

  await file.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG })
  await expect(preview).toBeVisible()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()

  await page.reload()
  await expect(preview).toBeVisible()
  expect((await sessionUser(page))?.avatarUrl).toContain('data:image/')

  await page.getByRole('button', { name: 'Remover foto' }).click()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await page.reload()
  await expect(preview).toHaveCount(0)
})

test('senha: erros nos campos certos e troca com sucesso', async ({ page }) => {
  const current = page.getByRole('textbox', { name: 'Senha atual' })
  const next = page.getByRole('textbox', { name: 'Nova senha', exact: true })
  const confirm = page.getByRole('textbox', { name: 'Confirmar nova senha' })
  const submit = page.getByRole('button', { name: 'Alterar senha' })

  // senha atual errada: erro no campo e continua logada (422, não 401)
  await current.fill('Errada@123')
  await next.fill('Nova@1234')
  await confirm.fill('Nova@1234')
  await submit.click()
  await expect(page.locator('#currentPassword-error')).toHaveText('Senha atual incorreta.')
  await expect(page).toHaveURL(/\/profile/)

  // validação local
  await current.fill(PASSWORD)
  await next.fill('curta')
  await confirm.fill('diferente')
  await submit.click()
  await expect(page.locator('#newPassword-error')).toBeVisible()
  await expect(page.locator('#confirm-error')).toHaveText('As senhas não conferem.')

  // sucesso: a senha antiga deixa de valer
  await next.fill('Nova@1234')
  await confirm.fill('Nova@1234')
  await submit.click()
  await expect(page.getByText('Senha alterada.')).toBeVisible()

  await page.evaluate(() => localStorage.removeItem('session'))
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('ana@example.com')
  const field = page.getByRole('textbox', { name: 'Senha', exact: true })
  await field.fill(PASSWORD)
  await field.press('Enter')
  await expect(page.getByText('E-mail ou senha inválidos.').first()).toBeVisible()

  await field.fill('Nova@1234')
  await field.press('Enter')
  await expect.poll(() => sessionUser(page)).not.toBeNull()
})