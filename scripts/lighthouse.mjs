import { spawn } from 'node:child_process'
import fs from 'node:fs'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test' // NOVO
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const RUNS = 3
const OUT = 'reports/lighthouse'

// páginas e perfis auditados (mobile = configuração padrão do Lighthouse)
const PAGES = { inicio: '/', detalhe: '/nft/nft-1' }
const PROFILES = { mobile: undefined, desktop: desktopConfig }
const TARGETS = { performance: 90, accessibility: 95, bestPractices: 95, seo: 90 }

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function isUp() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

let server
async function startServer() {
  if (await isUp()) {
    console.log(`Servidor já está rodando em ${BASE}, vou reutilizar.`)
    return
  }
  // "npx" no Windows precisa de shell
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('O servidor de preview não subiu. Rode "npm run build" antes.')
}

function stopServer() {
  if (!server) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    server.kill()
  }
}

fs.mkdirSync(OUT, { recursive: true })
await startServer()

// NOVO: usa o Chromium que o Playwright já instalou (não precisa do Chrome)
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new'],
})

const summary = {}
let env = {}

try {
  for (const [profile, config] of Object.entries(PROFILES)) {
    for (const [pageName, route] of Object.entries(PAGES)) {
      const runs = []
      for (let i = 1; i <= RUNS; i++) {
        console.log(`Medindo ${profile} / ${pageName} (${i}/${RUNS})...`)
        const result = await lighthouse(
          BASE + route,
          {
            port: chrome.port,
            output: ['json', 'html'],
            logLevel: 'error',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          },
          config,
        )
        const [json, html] = result.report
        fs.writeFileSync(`${OUT}/${profile}-${pageName}-${i}.json`, json)
        fs.writeFileSync(`${OUT}/${profile}-${pageName}-${i}.html`, html)

        const { categories: c, audits: a } = result.lhr
        runs.push({
          performance: Math.round((c.performance.score ?? 0) * 100),
          accessibility: Math.round((c.accessibility.score ?? 0) * 100),
          bestPractices: Math.round((c['best-practices'].score ?? 0) * 100),
          seo: Math.round((c.seo.score ?? 0) * 100),
          lcp: a['largest-contentful-paint'].numericValue,
          cls: a['cumulative-layout-shift'].numericValue,
          tbt: a['total-blocking-time'].numericValue,
        })
        env = {
          lighthouse: result.lhr.lighthouseVersion,
          userAgent: result.lhr.environment.hostUserAgent,
          formFactor: result.lhr.configSettings.formFactor,
          throttling: result.lhr.configSettings.throttlingMethod,
        }
      }
      summary[`${profile}/${pageName}`] = Object.fromEntries(
        ['performance', 'accessibility', 'bestPractices', 'seo', 'lcp', 'cls', 'tbt'].map(
          (key) => [key, median(runs.map((run) => run[key]))],
        ),
      )
    }
  }
} finally {
  await chrome.kill()
  stopServer()
}

// resumo em JSON e em tabela markdown (para colar no README)
fs.writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ runsPerPage: RUNS, targets: TARGETS, env, summary }, null, 2),
)

const mark = (value, target) => `${value} ${value >= target ? '✅' : '❌'}`
const rows = Object.entries(summary).map(
  ([key, s]) =>
    `| ${key} | ${mark(s.performance, TARGETS.performance)} | ${mark(s.accessibility, TARGETS.accessibility)} | ${mark(s.bestPractices, TARGETS.bestPractices)} | ${mark(s.seo, TARGETS.seo)} | ${(s.lcp / 1000).toFixed(2)} s | ${s.cls.toFixed(3)} | ${Math.round(s.tbt)} ms |`,
)
const table = [
  '| Perfil / página | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '|---|---|---|---|---|---|---|---|',
  ...rows,
].join('\n')

fs.writeFileSync(
  `${OUT}/summary.md`,
  `${table}\n\nMediana de ${RUNS} medições por página e perfil.\nLighthouse ${env.lighthouse} · ${env.userAgent} · throttling: ${env.throttling}\n`,
)
console.log(`\n${table}\n`)