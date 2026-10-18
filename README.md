# NFT Marketplace

Marketplace de NFTs feito em **React + TypeScript** como desafio técnico. Toda a "API" é simulada com **MSW** (REST e Socket.IO), então o projeto roda sozinho, sem back-end. Nenhuma blockchain, carteira ou pagamento real é usado: tudo é simulado.

**Stack:** React · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Tailwind · shadcn/ui · MSW · Socket.IO (cliente real, servidor simulado pelo MSW) · Playwright · Lighthouse.

---

## 1. Como rodar

```bash
npm install
npm run dev                          # desenvolvimento em http://localhost:5173
npm run build && npm run preview     # build de demonstração (mocks ativos)
npm run test:e2e                     # testes E2E (Playwright) e regressão visual
npm run lighthouse                   # build + auditoria Lighthouse
```

- Os mocks são ativados por configuração: variável **`VITE_ENABLE_MOCKS=true`** (arquivo `.env`). Eles também ficam ativos no build de demonstração.
- Na primeira vez que for rodar os testes: `npx playwright install chromium`.
- Relatório HTML do Playwright: `npx playwright show-report`.

## 2. Usuários de teste

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Ana Souza | `ana@example.com` | `Senha@123` | Tem uma carteira principal cadastrada |
| Bruno Lima | `bruno@example.com` | `Senha@123` | Não tem carteiras |

As senhas **nunca** são guardadas em texto puro no banco simulado: só o hash SHA-256.

## 3. Telas

Início (catálogo) · Detalhes do NFT · Carrinho · Pagamento · Confirmação de pedido · Login · Cadastro · Perfil (dados, avatar, senha) · Carteiras (principal e secundárias). Checkout, perfil, carteiras e pedidos exigem login.

## 4. Contratos REST

Todas as chamadas passam pelo Axios (`src/api/client.ts`, timeout de 8 s). Os valores em ETH trafegam sempre como **string decimal** (ex.: `"0.087500"`) e os cálculos usam `decimal.js`. **A cotação do servidor é a referência** para finalizar o pedido.

| Recurso | Endpoints |
|---|---|
| Sessão e conta | `POST /api/session/register`, `POST /api/session/login`, `GET /api/session`, `POST /api/session/logout` |
| NFTs | `GET /api/nfts` (busca, coleção, ordenação, faixa de preço e página por query string; resposta paginada `{ items, page, pageSize, total, totalPages }`), `GET /api/nfts/:id` |
| Favoritos | `GET /api/favorites`, `PUT /api/favorites/:nftId`, `DELETE /api/favorites/:nftId` |
| Carrinho | `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:nftId/:editionId`, `DELETE /api/cart/items/:nftId/:editionId`, `PUT /api/cart/coupon`, `DELETE /api/cart/coupon`, `POST /api/cart/merge` |
| Cotação | `POST /api/quote` |
| Carteiras | `GET /api/wallets`, `POST /api/wallets`, `PATCH /api/wallets/:id` |
| Pedidos | `POST /api/orders` (cabeçalho `Idempotency-Key` obrigatório), `GET /api/orders/:id` |
| Perfil | `GET /api/profile`, `PATCH /api/profile`, `POST /api/profile/password` |

**Carrinho do visitante:** quem não está logado usa o cabeçalho `X-Guest-Id`. No login, os itens do visitante são mesclados ao carrinho do usuário (`POST /api/cart/merge`).

**Cotação (`Quote`):** itens, subtotal, desconto, taxa de rede (`0.002500` ETH), total, cupom e uma lista de `issues` (`PRICE_CHANGED`, `OUT_OF_STOCK`, `QUANTITY_REDUCED`). O `quote.id` é um hash do conteúdo: muda quando preço, estoque ou total mudam. Cupons: `PROMO10` (10 % de desconto); `EXPIRED` é recusado como expirado; qualquer outro código é inválido.

**Formato de erro:** `{ code, message, fields?, quote? }`.

| Código | Status | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Campos inválidos (vem com `fields` por campo) |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | 401 | Sem sessão ou sessão vencida |
| `FORBIDDEN` | 403 | Recurso de outro usuário (ex.: pedido alheio) |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | Conflito (ex.: e-mail já cadastrado, carrinho vazio no pedido) |
| `OUT_OF_STOCK` | 409 | Item sem estoque ao criar o pedido (devolve a `quote` atual) |
| `QUOTE_STALE` | 409 | Valores mudaram desde a cotação aceita (devolve a nova `quote`) |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma chave de idempotência com conteúdo diferente |
| `TRANSIENT` | 5xx | Falha transitória (candidata a nova tentativa) |

## 5. Pedidos e idempotência

`POST /api/orders` recebe `{ quoteId, walletId, network, billing: { name, email } }` e o cabeçalho **`Idempotency-Key`**.

- **Mesma chave + mesmo conteúdo** devolve o **mesmo pedido** (nunca cria outro).
- **Mesma chave + conteúdo diferente** devolve `409 IDEMPOTENCY_CONFLICT`.
- No front, a chave é guardada em `sessionStorage` **por conteúdo do pedido**: reenviar o mesmo pedido (clique repetido, timeout, refresh) reaproveita a mesma chave.
- O servidor **recalcula a cotação** e compara com o `quoteId` enviado; se mudou, responde `QUOTE_STALE` e o checkout exige que o usuário aceite a nova cotação.
- O pedido nasce `pending` e é resolvido em ~3 s para `confirmed` (ou `refused`, no cenário `payment-declined`). Estados finais **nunca mudam**.
- Os itens e valores do pedido são um **snapshot**: o recibo nunca é recalculado a partir do catálogo.
- Ao confirmar, o servidor remove do carrinho **só** os itens e quantidades comprados. Pedido recusado mantém o carrinho.
- **Timeout:** no cenário `order-timeout` o pedido é criado, mas a resposta demora mais que o timeout do Axios. A tela avisa e o botão "Tentar novamente" reenvia **exatamente o mesmo payload** (mesma chave), recuperando o mesmo pedido, sem duplicar.
- `GET /api/orders/:id` sobrevive ao refresh: um pedido pendente continua e termina confirmado.

## 6. Política de cache, retry e sincronização

Definida em `src/lib/queryClient.ts`:

- **`staleTime` 30 s** e **`gcTime` 5 min**.
- **Retry só para falha transitória** (rede, timeout, 5xx), **no máximo 2 vezes**. Erros 4xx não são repetidos.
- **Mutations não têm retry automático**, para nunca duplicar uma operação (principalmente pedidos). A recuperação é sempre pela chave de idempotência.
- **Chaves de cache por usuário** (`['cart', userId]`, `['wallets', userId]`...): dados privados de um usuário nunca aparecem para outro, e a troca de usuário limpa o cache.
- **Cancelamento de respostas obsoletas:** as queries repassam o `signal` ao Axios; ao mudar filtros, a requisição antiga é cancelada.
- **Atualização otimista (favoritos):** o coração muda na hora, com rollback e aviso se a API falhar.
- **Invalidação coerente:** mutações de carrinho invalidam carrinho e cotação; eventos de socket invalidam as queries afetadas.
- **Polling de apoio:** `GET /api/orders/:id` é consultado a cada 3 s enquanto o pedido está `pending` (o evento `order.updated` normalmente chega antes).
- **Reconciliação:** ao reconectar o socket, o app invalida as queries e busca o estado real no REST.

## 7. Socket.IO simulado com MSW

- O cliente é o **`socket.io-client` de verdade**. O "servidor" é simulado por `ws.link` do MSW + `@mswjs/socket.io-binding`, na URL `wss://realtime.nft.local`.
- **Transporte: apenas WebSocket** (sem long-polling).
- Autenticação por evento `auth` com o token da sessão. Visitantes recebem só eventos públicos.
- **Eventos:** `nft.updated` (preço e disponibilidade) e `order.updated` (pedido confirmado ou recusado).
- Formato do evento: `{ id, type, resourceId, version, occurredAt, data }`. O front guarda a **última versão** de cada recurso e **ignora eventos duplicados e antigos**. Evento de pedido de outro usuário é descartado.
- **Cenário principal:** com um NFT no carrinho, o preço muda → aparece um aviso, o resumo atualiza e o **checkout bloqueia a confirmação** até o usuário aceitar a nova cotação.
- Os listeners são removidos e a conexão é fechada ao trocar de usuário ou desmontar.
- O `socket.io-client` é carregado com **import dinâmico** depois que o MSW inicia, senão ele usaria o `WebSocket` real do navegador.
- **Limitações:** o servidor vive na própria aba (não há broadcast entre abas) e a queda de conexão do WebSocket não é simulada. A retomada de pedido pendente é testada com **refresh da página**.

**Controle dos mocks no navegador (`window.__mock`):** `reset()`, `setScenario(nome)`, `expireSession()`, `changeNft(id, { price?, available?, editionId? })`, `emitRaw(evento, payload)`. `changeNft` altera o banco simulado e emite o evento, então REST e Socket.IO mostram **o mesmo dado**.

## 8. Cenários de mock

Ative com `?scenario=nome` na URL (ex.: `http://localhost:5173/?scenario=slow`). O cenário fica salvo no navegador: para voltar ao normal, use `?scenario=default`.

| Cenário | O que simula |
|---|---|
| `default` | Tudo funcionando |
| `slow` | Lentidão |
| `out-of-order` | Latência variável (respostas fora de ordem) |
| `server-error` | Erros 5xx |
| `offline` | Falha de conexão |
| `timeout` | Requisições que estouram o tempo limite |
| `empty` | Catálogo vazio |
| `favorite-fail` | Falha ao favoritar (testa o rollback) |
| `payment-declined` | Pagamento recusado |
| `order-timeout` | Pedido criado, mas a resposta demora mais que o timeout |
| `wallet-reject` | A carteira recusa a conexão |

Outros dados de teste: 48 NFTs (`nft-1` a `nft-48`), cada um com edições `Padrão` e `Rara`; alguns têm estoque esgotado (ex.: `nft-7` Padrão, `nft-5` Rara, `nft-35` as duas). O `nft-1` Padrão custa `0.087500` e tem 5 unidades.

## 9. Testes

**E2E com Playwright** (`e2e/`), em **Chromium, desktop (1440×900) e mobile (Pixel 7)**. Cada teste roda com estado isolado (contexto novo, `localStorage` vazio). Cobertura:

1. Catálogo: busca, filtros combinados, ordenação, paginação e restauração pelo histórico.
2. Detalhe direto e NFT inexistente.
3. Cadastro, login, sessão expirada, logout e troca de usuário.
4. Favoritos, incluindo falha com recuperação.
5. Carrinho: quantidades, remoção, cupom e persistência após refresh e login.
6. Compra completa até o recibo.
7. Pagamento recusado, clique repetido (1 pedido) e **timeout com recuperação do mesmo pedido**.
8. Perfil, avatar, senha e carteiras com erros.
9. Preço e disponibilidade por Socket.IO no checkout.
10. Eventos duplicados e antigos, e retomada de pedido pendente após refresh.
11. Acessibilidade: teclado, foco, erros associados, ausência de overflow horizontal.
12. Skeletons em carregamento lento, falha e nova tentativa.

**Regressão visual:** início, detalhe e carrinho, em desktop e mobile, com imagens de referência versionadas em `e2e/visual.spec.ts-snapshots/` (geradas no Windows, por isso o sufixo `-win32`). Para regenerar: `npx playwright test e2e/visual.spec.ts --update-snapshots`.

**Última rodada completa:** 97 testes passaram e 1 ficou instável (o da sessão expirada, que passa na nova tentativa; o projeto usa `retries: 1`). Os 6 testes visuais falharam só por faltarem as imagens de referência e passaram depois de gerá-las. Relatório HTML e traces das falhas são gerados pelo Playwright.

## 10. Lighthouse

Auditoria de **início (`/`) e detalhe (`/nft/nft-1`)**, perfis **mobile e desktop**, no **build otimizado** (`vite preview`), cenário `default`, com **3 medições por página e perfil** (mediana). Script: `scripts/lighthouse.mjs`. Relatórios HTML e JSON de cada medição, mais `summary.json` e `summary.md`, ficam em `reports/lighthouse/`. O script usa o Chromium instalado pelo Playwright.

| Perfil / página | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| mobile/inicio | 70 ❌ | 100 ✅ | 100 ✅ | 92 ✅ | 4.02 s | 0.000 | 430 ms |
| mobile/detalhe | 71 ❌ | 100 ✅ | 100 ✅ | 92 ✅ | 4.18 s | 0.000 | 361 ms |
| desktop/inicio | 99 ✅ | 100 ✅ | 100 ✅ | 92 ✅ | 0.91 s | 0.000 | 25 ms |
| desktop/detalhe | 99 ✅ | 100 ✅ | 100 ✅ | 92 ✅ | 0.97 s | 0.004 | 8 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Ambiente: Lighthouse com throttling padrão do perfil mobile (CPU 4× mais lenta e rede 4G simulada), Chromium do Playwright em Windows, sem outros processos pesados rodando.

**Justificativa do resultado abaixo da meta (Performance no mobile):** o desktop passa com folga (99), o que indica que o problema é custo de execução de JavaScript sob CPU lenta, e não de rede ou de layout (CLS é 0). As causas prováveis, **ainda não isoladas por medição individual**, são:

- **O MSW precisa iniciar antes da primeira renderização.** O app aguarda `startMocks()` (registro do worker e leitura do banco simulado) antes de renderizar. Isso empurra o LCP e aparece como TBT alto (361 a 430 ms) quando a CPU é 4× mais lenta.
- **Peso do código dos mocks.** O pacote do MSW (`browser`, ~453 kB; ~168 kB com gzip) é o maior arquivo do build. Ele existe só para a demonstração: com uma API real, ele não seria enviado ao usuário.
- **O Lighthouse limpa o armazenamento a cada medição**, então toda medição reinicia o banco simulado do zero.

Não foi feita nenhuma simplificação só para pontuar: a auditoria carrega as imagens, fontes e funcionalidades reais. Melhorias possíveis, não aplicadas por falta de tempo: carregar o MSW de forma preguiçosa, renderizar o esqueleto antes de o worker ficar pronto, e reduzir o JavaScript inicial do catálogo.

## 11. Assets e acessibilidade

**Assets:** quando os arquivos do Figma não estavam disponíveis, as imagens dos NFTs são **SVGs gerados pelo próprio projeto** (fixtures do mock). A fonte usada é a **Geist**, padrão do shadcn/ui, e não a fonte do Figma.

**Acessibilidade:**
- Foco visível e navegação por teclado nos fluxos cobertos pelos testes (login, formulários e navegação principal); links e botões com nomes acessíveis.
- Formulários com `label` ligado ao campo, erros anunciados por leitor de tela (`role="alert"`, `aria-invalid`, `aria-describedby`).
- Estados indicados por texto, e não só por cor (ex.: selo "Principal", "Indisponível", status da carteira).
- Endereços de carteira abreviados na tela e completos para leitor de tela.
- Mensagens de carregamento e de tempo real em regiões com `role="status"` ou `role="alert"`; avisos de mutações com toast.
- Skeletons com shimmer, respeitando `prefers-reduced-motion`.
- Sem overflow horizontal nas rotas verificadas pelos testes automatizados, em desktop e mobile.
- `index.html` com `lang="pt-BR"`, `<title>` e `<meta name="description">`.
- Lighthouse de Accessibility: 100 em todas as páginas auditadas.

## 12. Limitações conhecidas

- **Performance no mobile** abaixo da meta (seção 10).
- **Fidelidade ao Figma:** conferência visual feita por inspeção manual; podem existir pequenas diferenças de espaçamento, tipografia (Geist em vez da fonte do Figma) e imagens (SVGs gerados).
- **Regressão visual:** cobre início, detalhe e carrinho. A tela de **pagamento** ainda não tem imagem de referência.
- **Foco em diálogos:** o app não usa diálogos nem gavetas, então esse item não se aplica.
- **WebSocket:** o servidor é simulado dentro da aba; queda de conexão e broadcast entre abas não são simulados.
- **URL do catálogo:** os preços aparecem com aspas codificadas (`minPrice=%220.05%22`). Funciona, mas não é o formato mais limpo.
- **`PRICE_CHANGED`:** existe nos tipos de cotação, mas o servidor simulado ainda não gera esse aviso (a mudança de preço é tratada pela cotação nova e pelo bloqueio do checkout).
- **Teste da sessão expirada:** pode ficar instável quando o computador está sob carga; passa com `retries: 1`.
- Imagens de referência da regressão visual valem **só para Windows** (`-win32`).

- **Visual:** o tema escuro com destaque cobre, a fonte Roboto Mono, o cabeçalho, o hero e os cartões foram aproximados a partir do protótipo do Figma (cores estimadas). As telas não têm a mesma estrutura do Figma (faltam barra lateral de coleções, rodapé e newsletter) e as imagens dos NFTs são gradientes SVG gerados. As medições do Lighthouse da seção 10 já foram refeitas com o tema escuro.


