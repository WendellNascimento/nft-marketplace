import { HttpResponse, delay } from 'msw'

export type ScenarioName =
  | 'default'
  | 'slow'
  | 'out-of-order'
  | 'server-error'
  | 'offline'
  | 'timeout'
  | 'empty'
  | 'favorite-fail'
  | 'payment-declined'
  | 'order-timeout'
  | 'wallet-reject'

// o cenário vem da URL (?scenario=slow) ou do localStorage
export function getScenario(): ScenarioName {
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  if (fromUrl) localStorage.setItem('mock-scenario', fromUrl)
  return (localStorage.getItem('mock-scenario') as ScenarioName) ?? 'default'
}

let counter = 0
export const resetCounters = () => {
  counter = 0
}

// Chame no início de cada handler. Se devolver algo, o handler deve devolver isso.
export async function simulateNetwork(tag: string): Promise<Response | null> {
  const scenario = getScenario()
  counter++

  if (scenario === 'offline') return HttpResponse.error()

  if (scenario === 'server-error' && tag === 'nfts') {
    return HttpResponse.json(
      { code: 'TRANSIENT', message: 'Erro no servidor' },
      { status: 503 },
    )
  }

  if (scenario === 'timeout' && tag === 'nfts') await delay(15_000)

  if (scenario === 'slow') await delay(2500)
  else if (scenario === 'out-of-order') await delay(counter % 2 === 1 ? 1500 : 150)
  else await delay(150 + (counter % 5) * 60) // latência variável, mas previsível

  return null
}

export const apiError = (
  status: number,
  code: string,
  message: string,
  extra: object = {},
) => HttpResponse.json({ code, message, ...extra }, { status })