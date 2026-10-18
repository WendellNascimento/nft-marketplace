import { useEffect, useRef, useState } from 'react'

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'rejected'

// o cenário de mock fica salvo no navegador (ver lição 8)
const scenario = () => (localStorage.getItem('mock-scenario') ?? '').replace(/"/g, '')

// conexão SIMULADA: não existe blockchain real neste desafio
export function useWalletConnection(walletId: string | undefined) {
  const [status, setStatus] = useState<WalletStatus>('disconnected')
  const timer = useRef<number | undefined>(undefined)

  // trocar de carteira desconecta; ao sair da tela o timer é limpo
  useEffect(() => {
    setStatus('disconnected')
    return () => window.clearTimeout(timer.current)
  }, [walletId])

  const connect = () => {
    setStatus('connecting')
    timer.current = window.setTimeout(() => {
      setStatus(scenario() === 'wallet-reject' ? 'rejected' : 'connected')
    }, 800)
  }

  const disconnect = () => {
    window.clearTimeout(timer.current)
    setStatus('disconnected')
  }

  return { status, connect, disconnect }
}