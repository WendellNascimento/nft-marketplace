import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

const SCALE = 6 // casas decimais usadas nos cálculos

export const add = (a: string, b: string) =>
  new Decimal(a).plus(b).toFixed(SCALE)

export const sub = (a: string, b: string) =>
  new Decimal(a).minus(b).toFixed(SCALE)

export const mulQty = (price: string, qty: number) =>
  new Decimal(price).times(qty).toFixed(SCALE)

export const percentOf = (value: string, pct: number) =>
  new Decimal(value).times(pct).div(100).toFixed(SCALE)

export const gt = (a: string, b: string) => new Decimal(a).gt(b)

// só para exibir na tela: 4 casas decimais
export const formatEth = (value: string) =>
  `${new Decimal(value).toFixed(4)} ETH`