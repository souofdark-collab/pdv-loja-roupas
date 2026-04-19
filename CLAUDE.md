# CLAUDE.md

Guia completo para o Claude Code trabalhar neste repositório. Leia inteiro antes de implementar qualquer coisa.

---

## Comandos

```bash
# Desenvolvimento (mata processos antigos primeiro)
powershell -Command "Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force"
npm run dev

# Build para produção
npm run build          # build do frontend (Vite → dist/)
npm run electron:build # build completo + instalador (electron-builder → release/)

# Testes (smoke tests — vitest + supertest)
npm test
```

**Login padrão:** `admin` / `admin123`

---

## GitHub — Fluxo de Atualização

Após qualquer alteração de código, commitar e subir para o GitHub:

```bash
git add <arquivo(s)>
git commit -m "descrição do porquê da mudança"
git push origin master
```

**Regras:**
- Branch principal é `master` (não `main`)
- Sempre criar novo commit — nunca `--amend` em commits já publicados
- Nunca `--force` no push
- Se o remote não estiver configurado: `git remote add origin <url>`

---

## Arquitetura

```
pdv-loja-roupas/
├── src/                        # Frontend React
│   ├── App.jsx                 # Roteamento, estado global (user, theme), ErrorBoundary wrap
│   ├── index.css               # Variáveis CSS globais (tema dark, cores customizáveis)
│   ├── components/
│   │   ├── Layout.jsx          # Sidebar fixa (height:100vh, overflow:hidden) + badge estoque baixo
│   │   ├── Modal.jsx           # Modal centralizado + hook useModal() — OBRIGATÓRIO para todos os dialogs
│   │   └── ErrorBoundary.jsx   # Captura erros React e exibe fallback amigável
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── PDV.jsx             # Ponto de venda; freeza vendedor/caixa em saleVendedor/saleCaixa
│   │   ├── Vendas.jsx          # Histórico + cancelamento + reimpressão (via buildReceiptHTML)
│   │   ├── Produtos.jsx        # CRUD + criação de N variações de uma vez
│   │   ├── Estoque.jsx         # CRUD + movimentação + busca + código de barras por item
│   │   ├── ControleCaixa.jsx   # 3 abas: Estoque Total / Estoque Atual / Receita x Despesas (com taxas cartão)
│   │   ├── Clientes.jsx
│   │   ├── Promocoes.jsx
│   │   ├── Despesas.jsx
│   │   ├── FechamentoCaixa.jsx
│   │   ├── Trocas.jsx
│   │   ├── Relatorios.jsx
│   │   ├── Auditoria.jsx
│   │   ├── Usuarios.jsx
│   │   ├── Configuracoes.jsx   # Abas: Empresa, Tema, Pagamentos, Taxas Cartão, Impressora, Auditoria, Backup
│   │   └── Backup.jsx
│   └── utils/
│       ├── pdfExport.js        # PDF via window.print() em iframe oculto
│       ├── receipt.js          # buildReceiptHTML — HTML único do cupom (PDV + reimpressão)
│       ├── pix.js              # buildPixPayload — payload EMV QR PIX
│       └── fuzzySearch.js      # Busca tolerante a acentos/typos
│
├── electron/
│   ├── main.js                 # Entry point Electron + Express :3001 + IPC handlers
│   ├── preload.js              # window.api (fetch) + window.electron (IPC)
│   └── api/
│       ├── db.js               # Banco JSON em memória (atomic write + hash-chain audit)
│       └── routes/
│           ├── auth.js
│           ├── backup.js
│           ├── vendas.js       # Salva tamanho/cor; calcula taxa_cartao; POST retorna vendedor/usuario/cliente_nome
│           ├── estoque.js      # GET retorna codigo_barras do item (fallback: codigo do produto)
│           ├── produtos.js     # POST cria N produtos + N entradas de estoque com barcodes únicos
│           ├── clientes.js
│           ├── categorias.js
│           ├── promocoes.js
│           ├── despesas.js
│           ├── usuarios.js
│           ├── trocas.js
│           ├── caixa.js
│           ├── fiado.js        # Contas em aberto + pagamentos fiado/crediário
│           ├── relatorios.js
│           ├── auditoria.js
│           └── configuracoes.js
│
├── tests/                      # Smoke tests (vitest + supertest)
│   ├── helpers/buildApp.js     # Monta Express em tmp dir para testes isolados
│   └── smoke.test.js           # Auth, vendas, cancelamento, fechamento, backup, auditoria
│
├── vite.config.js              # Apenas react() — SEM vite-plugin-electron
└── package.json
```

---

## Stack

- **Frontend:** React 18 + React Router 6, Vite 6
- **Desktop:** Electron 33
- **Backend local:** Express na porta 3001 (dentro do Electron)
- **Banco:** Arquivos JSON em `%APPDATA%\pdv-loja-roupas\` (sem SQLite)
- **Auth:** bcryptjs
- **PDF:** `window.print()` via iframe oculto
- **Impressão direta:** `ipcMain.handle('print-receipt', ...)` → `webContents.print()` silent

---

## Banco de Dados

> **Migração SQLite concluída** (2026-04-18). Todas as 8 etapas da Fase A prontas. Ver seção "Migração SQLite — Estado" no fim deste arquivo. Próxima fase é B (TypeScript).

**Localização:** `%APPDATA%\pdv-loja-roupas\pdv.sqlite` (WAL + foreign_keys ON). JSON files legados renomeados para `*.json.pre-sqlite` após a migração one-shot.

**Tabelas:**
`usuarios`, `clientes`, `categorias`, `produtos`, `estoque`, `estoque_movimentacoes`, `vendas`, `venda_itens`, `promocoes`, `promocoes_regras`, `despesas_categorias`, `despesas`, `configuracoes`, `formas_pagamento`, `trocas`, `historico_precos`, `log_acoes`, `abertura_caixa`, `fiado_pagamentos`

**Campos especiais em `vendas`:** `taxa_cartao_pct`, `valor_taxa_cartao`, `valor_liquido` (calculados no POST), `saldo_devedor` (fiado), `motivo_cancelamento`.

**Auditoria imune a adulteração:** `log_acoes` tem cadeia hash SHA256 (`hash_anterior` + `hash`). Verificação em `db.verifyAuditChain()` e via `GET /api/auditoria/verificar`.

**API do db:**
```js
db.select(table, where)     // filtra por igualdade
db.findOne(table, where)
db.insert(table, data)      // retorna { lastInsertRowid }
db.update(table, id, data)
db.delete(table, id)
db._data[table]             // Proxy: getter = SELECT *; setter = DELETE+INSERT atômico (backup/restore)
db._save(table)             // no-op (SQLite persiste sincronamente — mantido para compat)
db._sqlite                  // handle raw better-sqlite3 — use para SQL direto em casos especiais
db.transaction(fn)          // envelopa fn em transação SQLite (retorna função chamável)
db.backupTo(path)           // online backup via sqlite.backup() — retorna Promise
db.verifyAuditChain()       // valida cadeia SHA256 em log_acoes por id ASC
```

**Atenção:** `db.findOne('usuarios', { login, ativo: 1 })` — `ativo` deve ser `1` (número), não `true`.

**Backups automáticos:** `%APPDATA%\pdv-loja-roupas\backups-auto\` — gerado ao iniciar e a cada 24h, mantém os últimos 7.

---

## Como o Dev Funciona

`vite-plugin-electron` foi **removido** do `vite.config.js` — causava dupla instância.

Fluxo:
1. `vite` sobe frontend em `:5173`
2. `wait-on` aguarda `:5173`
3. `electron .` carrega `electron/main.js`
4. `main.js` inicia Express em `:3001`
5. Electron abre janela em `http://localhost:5173`

**Se travar:** `powershell -Command "Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force"`

---

## Bridge Frontend ↔ API

**`window.api`** — fetch para Express `:3001`:
```js
window.api.get(url)
window.api.post(url, body)
window.api.put(url, body)
window.api.delete(url, body)  // body opcional
```
Erros HTTP fazem `throw` com `.status`.

**`window.electron`** — IPC:
```js
window.electron.getPrinters()
window.electron.printReceipt(html, printerName)
window.electron.print(content)  // legado
```

---

## Tema e Cores

`applyTheme()` em `App.jsx` aplica variáveis CSS no `:root`.

| Config | Variável CSS |
|---|---|
| `cor_accent` | `--accent` |
| `cor_bg` | `--bg-primary` |
| `cor_bg_secondary` | `--bg-secondary` (sidebar) |
| `cor_card` | `--bg-card` |
| `cor_text` | `--text-primary`, `--text-secondary` |
| `cor_btn` | `--btn-bg` |

---

## ⚠️ REGRA CRÍTICA — Dialogs no Electron

**NUNCA use `window.confirm()`, `window.alert()` ou `window.prompt()`.**

Qualquer dialog nativo causa perda de foco no OS — o teclado para de funcionar até o usuário clicar na janela. Este bug foi corrigido em **todas** as páginas com custo alto. Já ocorreu dezenas de vezes.

### Padrão obrigatório — hook `useModal()` em `src/components/Modal.jsx`

```jsx
import { useModal } from '../components/Modal';

function MinhaPagina() {
  const { showAlert, askConfirm, askInput, modalEl } = useModal();

  const handleDelete = (id) => {
    askConfirm('Excluir este item?', async () => {
      await window.api.delete(`/api/x/${id}`);
      showAlert('Item excluído');
    }, { title: 'Confirmar exclusão', danger: true });
  };

  const handleRefuse = (id) => {
    askInput('Motivo da recusa', async (motivo) => {
      await window.api.put(`/api/trocas/${id}`, { status: 'recusada', observacao: motivo });
    }, { title: 'Recusar', placeholder: 'Digite o motivo...', requireInput: true, danger: true });
  };

  return (
    <div>
      {/* ... conteúdo ... */}
      {modalEl}
    </div>
  );
}
```

**API do hook:**
- `showAlert(msg, opts?)` — alerta simples com botão OK
- `askConfirm(msg, onConfirm, opts?)` — confirmação (Cancelar / Confirmar)
- `askInput(msg, onConfirm, opts?)` — prompt com `<input>`; recebe valor digitado
- `opts`: `{ title, danger, confirmLabel, cancelLabel, placeholder, inputType, requireInput, maxWidth }`
- Teclado: Enter confirma, Escape fecha. `activeElement.blur()` é chamado automaticamente.

**Nunca crie o modal inline em cada página.** Se precisar de algo fora do escopo do hook, estenda `Modal.jsx` — não copie JSX entre páginas.

---

## ⚠️ REGRA CRÍTICA — useEffect e Temporal Dead Zone

Todo `useEffect` que referencia um state ou ref **deve ser declarado DEPOIS** do `useState`/`useRef` correspondente. O array de dependências é avaliado imediatamente — se a variável não foi declarada ainda, lança ReferenceError e o componente fica em branco (tela vazia).

Já ocorreu 3× neste projeto: `barcodeMode` em PDV.jsx, `barcodeMode` em Produtos.jsx, `showProductModal` em PDV.jsx.

---

## Funcionalidades Implementadas

### Layout (src/components/Layout.jsx)
- Sidebar **fixa**: container usa `height: 100vh; overflow: hidden` — apenas o `<main>` rola
- Badge de estoque baixo na sidebar
- Menu inclui rota `/controle-caixa` → ControleCaixa

### PDV (src/pages/PDV.jsx)
- Busca em modal dedicado com filtro por categoria (pills) e estoque disponível
- Leitura de código de barras: busca primeiro em `estoque.codigo_barras` (item específico), depois em `produto.codigo_barras`
- `addToCart(produto, estoqueItemOverride)` aceita item de estoque específico para garantir baixa correta
- Promoções por produto aplicadas automaticamente; badge com preço riscado no carrinho
- HTML do cupom é gerado por **`buildReceiptHTML()` em `src/utils/receipt.js`** (compartilhado com reimpressão em Vendas)
- Recibo exibe **apenas o Vendedor selecionado** — nunca o caixa/usuário logado
- `saleVendedor` e `saleCaixa` são estados que **congelam os valores no momento da venda** (antes do reset do formulário)
- Recibo exibe tamanho/cor somente quando preenchidos (não mostra `-/-`)
- Impressão: silenciosa se `impressora_padrao` configurada, senão abre diálogo
- Fechar PDV com itens no carrinho exige confirmação (modal React, não `confirm()`)

### Produtos (src/pages/Produtos.jsx + electron/api/routes/produtos.js)
- Campo **"Variações a cadastrar"** (`num_variacoes`, padrão 1): ao salvar cria N produtos com o mesmo nome e N entradas de estoque, cada um com código de barras único gerado automaticamente (`789` + timestamp + random)
- O primeiro produto pode receber código de barras manual; os demais são gerados
- Validação de duplicidade de código de barras (retorna 400 se conflito)
- Após criar, editar cada entrada no Estoque para definir tamanho/cor/quantidade

### Estoque (src/pages/Estoque.jsx + electron/api/routes/estoque.js)
- **Campo de busca** em tempo real: filtra por produto, tamanho, cor ou código de barras
- Cada item de estoque tem seu próprio `codigo_barras` exibido na tabela
- `GET /estoque` retorna `codigo_barras` do item; se vazio, usa `codigo_barras` do produto como fallback
- Edição salva `tamanho`, `cor`, `quantidade`, `minimo` e `codigo_barras`
- **Tamanhos numéricos:** apenas pares — `36, 38, 40, 42, 44, 46` (mais `PP P M G GG XG XXG`)
- Movimentação manual (entrada/saída/ajuste) com validação de estoque negativo

### Vendas (src/pages/Vendas.jsx + electron/api/routes/vendas.js)
- `POST /vendas`: lê item de estoque antes de inserir `venda_itens` para salvar `tamanho` e `cor`
- `GET /vendas/:id`: faz join com tabela `estoque` para popular `tamanho`/`cor` em vendas antigas
- Cancelamento: motivo obrigatório + autenticação admin + log de auditoria

### ControleCaixa (src/pages/ControleCaixa.jsx)
Página com **3 abas**:

**Aba 1 — Estoque Total**
- Cards: Total de Itens, Capital Investido, Receita Prevista, Lucro Previsto
- Tabela detalhada por SKU com `maxHeight: calc(100vh - 420px)` (≈12 linhas em tela cheia)

**Aba 2 — Estoque Atual**
- Cards: Total de Vendas, Receita Realizada, Ticket Médio, Descontos Concedidos
- Tabela de todas as vendas (ordenadas por data desc)
- Tabela de trocas/devoluções com badge de pendentes

**Aba 3 — Receita x Despesas**
- Cards (5): Receita Realizada, Total Despesas, **Taxas de Cartão**, Saldo do Caixa, Margem Líquida
- Barra visual de 3 segmentos (despesas / taxas cartão / saldo)
- Tabela de despesas por categoria com % sobre receita
- Resumo: Receita − Despesas − Taxas Cartão = Saldo Líquido

### Configurações (src/pages/Configuracoes.jsx)
- Abas: Dados da Empresa, Tema e Cores, Formas de Pagamento, **Taxas Cartão**, Impressora, Auditoria, Backup
- Aba Taxas Cartão: percentuais por forma (`debito`, `credito_1`...`credito_12`) salvos em `configuracoes.chave = 'taxas_cartao'` (JSON)
- Aba Impressora: lista via `window.electron.getPrinters()`, salva `impressora_padrao`, botão "Imprimir Teste"
- CNPJ com validação de dígitos verificadores

### Backup (src/pages/Backup.jsx)
- Export: `GET /api/backup/export` — todas as tabelas via `db._data`
- Import: `POST /api/backup/restore` — substitui tudo (pede confirmação via modal React)
- Wipe: modal com login + senha do admin principal

### Auditoria
Registra automaticamente: Login, Nova Venda, Cancelamento, Entrada/Saída/Ajuste Estoque, Produto Cadastrado/Desativado, Alteração de Preço, Abertura/Fechamento de Caixa.

---

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/login` | Auth + log |
| GET | `/api/produtos` | Lista produtos ativos, ordenados por nome |
| GET | `/api/produtos/buscar` | Busca por nome/barcode — **DEVE ficar antes de `/produtos/:id`** |
| GET | `/api/produtos/:id` | Produto por ID |
| POST | `/api/produtos` | Cria N produtos + N estoques (`num_variacoes`) |
| PUT | `/api/produtos/:id` | Atualiza; grava histórico se preço mudou |
| DELETE | `/api/produtos/:id` | Desativa (ativo=0) |
| GET | `/api/estoque` | Lista com `produto_nome` + `codigo_barras` (fallback produto) |
| PUT | `/api/estoque/:id` | Atualiza qtd, mínimo, tamanho, cor, código de barras |
| POST | `/api/estoque/movimentacao` | Entrada/saída/ajuste + log |
| GET | `/api/estoque/movimentacoes` | Histórico (aceita `?estoque_id=`) |
| GET | `/api/vendas` | Lista vendas (aceita `?inicio=&fim=`) |
| POST | `/api/vendas` | Cria venda + baixa estoque + log |
| PUT | `/api/vendas/:id` | Cancela/atualiza |
| GET | `/api/vendas/:id` | Detalhes com itens + tamanho/cor |
| GET | `/api/despesas` | Lista despesas com `categoria_nome` |
| GET | `/api/trocas` | Lista trocas/devoluções |
| GET | `/api/relatorios/fechamento` | `?data_inicio=&data_fim=` |
| GET | `/api/auditoria` | Log de ações |
| GET | `/api/backup/export` | Export raw de todas as tabelas |
| POST | `/api/backup/restore` | Restore completo |
| POST | `/api/backup/wipe` | Limpar banco (só admin principal) |
| GET | `/api/caixa/atual` | Abertura em aberto |
| POST | `/api/caixa/abertura` | Abrir caixa |
| PUT | `/api/caixa/fechamento/:id` | Fechar caixa |
| GET | `/api/promocoes/ativas` | Promoções ativas com regras |
| GET | `/api/fiado/clientes` | Clientes com saldo devedor agregado |
| GET | `/api/fiado/cliente/:cliente_id` | Vendas + pagamentos fiado de um cliente |
| POST | `/api/fiado/pagamento` | Registra pagamento e abate `saldo_devedor` |
| GET | `/api/auditoria/verificar` | Valida cadeia hash SHA256 do log |

## IPC Electron

| Handler | Descrição |
|---------|-----------|
| `get-printers` | `mainWindow.webContents.getPrintersAsync()` |
| `print-receipt` | BrowserWindow oculta + `webContents.print()` silent |
| `dialog:print` | Legado |

---

## Padrões de UI

### Tabelas com scroll
Todas as tabelas com muitos itens usam:
```jsx
<div style={{ maxHeight: 480, overflowY: 'auto' }}>
  <table>...</table>
</div>
```
Para telas onde o usuário quer ver mais itens (ex: ControleCaixa): `calc(100vh - Xpx)` com `minHeight`.

### Tabs (submenus)
Padrão usado em Configurações e ControleCaixa:
```jsx
const [tab, setTab] = useState('primeiro');
// botão de tab:
style={{ background: tab === id ? 'var(--accent)' : 'transparent', borderRadius: tab === id ? '8px 8px 0 0' : 0, ... }}
```

---

## Testes

**Stack:** `vitest` + `supertest`. Arquivos em `tests/` (ESM, usam `createRequire` para importar backend CJS).

```bash
npm test
```

- `tests/helpers/buildApp.js` monta um Express isolado em diretório temporário (`process.env.APPDATA` e `HOME` sobrescritos), recarregando `db.js` e todas as rotas com `require.cache` limpo.
- `tests/smoke.test.js` cobre: login (OK/fail), criação de venda (com baixa de estoque + log), bloqueio por estoque insuficiente, venda fiado exige cliente, cálculo de taxa cartão por parcela, cancelamento com motivo + log, fechamento de caixa, export/restore de backup, verificação de cadeia de auditoria (ok + detecção de violação).

Rodar `npm test` antes de qualquer commit que mexa em rotas, db ou auditoria.

---

## Bugs Conhecidos / Histórico

### Dialogs nativos causam perda de foco (RESOLVIDO — NUNCA REGREDIR)
Ver seção "REGRA CRÍTICA — Dialogs no Electron" acima. Corrigido em todas as páginas: Produtos, Estoque, Categorias, Clientes, Usuarios, Despesas, Promocoes, Trocas, Configuracoes, Backup.

### useEffect em temporal dead zone → tela branca (RESOLVIDO, RECORRENTE)
Ver seção "REGRA CRÍTICA — useEffect" acima.

### Dupla instância Electron (RESOLVIDO)
`vite-plugin-electron` removido do `vite.config.js`.

### Admin com `ativo: 0` (RESOLVIDO)
`db.init()` corrige automaticamente ao iniciar.

### Login falha após restore (RESOLVIDO)
`auth.js` verifica `!user.senha_hash`; `db.init()` recria hash se ausente.

### Despesas: categoria mostrando "-" (RESOLVIDO)
`Number(categoria_id)` no insert/update/find.

### Backup incompleto pré-2026-04-17 (RESOLVIDO)
Backup agora usa `GET /api/backup/export` que lê `db._data` direto.

### `/produtos/buscar` retornava 404 (RESOLVIDO)
Rota movida para antes de `/produtos/:id` no Express.

### vendas.js PUT: `forma_pagamento` undefined (RESOLVIDO)
Fix: `forma_pagamento || venda?.forma_pagamento`.

### Estoque GET sobrescrevia código de barras do item (RESOLVIDO)
Campo do produto renomeado para `codigo_barras_produto`; `codigo_barras` do item preservado com fallback.

### Recibo mostrava usuário logado em vez do vendedor selecionado (RESOLVIDO — 2026-04-18)
Raiz: `setSelectedVendedor(null)` era executado antes do recibo ser renderizado. Fix:
1. Novos estados `saleVendedor` / `saleCaixa` em PDV.jsx congelam os valores no instante da venda.
2. Reset do vendedor movido para o fechamento do recibo (ESC / "Nova Venda"), não para logo após o POST.
3. `POST /api/vendas` agora retorna `vendedor_nome`, `usuario_nome` e `cliente_nome` na resposta.
4. `buildReceiptHTML` exibe **apenas Vendedor** (linha de Caixa removida) — pedido explícito do usuário.

### `alert()` nativo reintroduzido em Vendas.jsx (RESOLVIDO — 2026-04-18)
Regressão da regra crítica de dialogs. Substituído por `useModal().showAlert`.

---

## Migração SQLite — Estado

**Fase A (SQLite) — 100% concluída em 2026-04-18.** Dados reais (274 registros, 18 tabelas) migrados com sucesso em dry-run; cadeia de auditoria validada em 88 entradas (ok=true). Todos os 14 smoke tests passam.

| Fase | Status | Descrição |
|------|--------|-----------|
| A1 | ✅ | `better-sqlite3` instalado; `electron/api/migrations/001_initial.sql` (19 tabelas + FKs + índices). |
| A2 | ✅ | `electron/api/migrator.js` — aplica `migrations/NNN_*.sql` pendentes em transação, rastreia em `schema_migrations`. |
| A3 | ✅ | `db.js` reescrito com `better-sqlite3`. Mesma API (`select/findOne/insert/update/delete`). `_data` é Proxy (getter retorna SELECT *; setter faz DELETE+INSERT com FKs off). `_save` virou no-op. Novo: `db._sqlite` (raw handle), `db.transaction(fn)`, `db.backupTo(path)`. |
| A4 | ✅ | `POST /vendas` envelopado em `db.transaction()` (venda + itens + baixa estoque + movimentações + log atômicos). `POST /produtos` valida todos os barcodes antes de entrar na transação (fail fast). |
| A5 | ✅ | `electron/api/json-migration.js` — one-shot. Dispara quando `*.json` existe E todas as tabelas SQLite estão vazias. Importa na ordem de FKs (usuarios → clientes → produtos → estoque → vendas → venda_itens etc.), coerce `INT_FIELDS` (`categoria_id` "1" → 1), renomeia `.json` → `.json.pre-sqlite` como safety net. |
| A6 | ✅ | `insertLogAcao` usa `sqlite.transaction()` para serializar hash-chain. Insere com nonce random, lê `lastInsertRowid`, computa hash com `id` real, UPDATE final. `verifyAuditChain()` lê via `SELECT ... ORDER BY id ASC`. Migração re-sela cadeia em ordem de `id` (o JSON legado salvava em ordem de array). |
| A7 | ✅ | Backup restore mantém formato JSON wire (Proxy setter DELETE+INSERT). Auto-backup em `backups-auto/` agora grava **`pdv.sqlite` online + `snapshot.json`**; retém últimos 7. |
| A8 | ✅ | 14 smoke tests passando (12 originais + rollback de venda com estoque inexistente + FK órfã em venda_itens). Teste de adulteração atualizado para mutar via `db._sqlite` (Proxy retorna cópias). |

**Decisões tomadas:**
- Driver: `better-sqlite3` (síncrono, prebuilt Windows, integra bem com Electron).
- Fallback de backup em JSON mantido para debug manual (ambos `.sqlite` + `snapshot.json` em cada backup).
- Importante: `PRAGMA foreign_keys` é **silenciosamente ignorado dentro de transações**. O Proxy setter toggle FKs off **antes** de abrir a transação e on depois (em `finally`).
- TypeScript inicia agora (Fase B); strict apenas em arquivos novos/migrados.
- Zod entra junto da fase B4 (rotas tipadas + validação runtime no mesmo commit).

## Fase B — TypeScript (planejada)

| Fase | Descrição |
|------|-----------|
| B1 | `tsconfig.json` com `strict: true`, `allowJs: true` (coexistência). Instalar `typescript`, `@types/node`, `@types/express`, `zod`. Script `typecheck`. |
| B2 | `shared/types.ts` — interfaces para todas as tabelas derivadas do schema SQL. Fonte única de verdade consumida por backend e frontend. |
| B3 | `db.ts` (portar `db.js`) tipado — generics em `select<T>/insert<T>/update/delete` via map de tabelas. |
| B4 | Rotas migradas para TS + schemas Zod em `body`/`params`/`query`. Começar por `vendas.ts` (mais crítica) e `produtos.ts`. |
| B5 | Frontend: `src/api/*.ts` wrappers de `window.api.*` tipados usando `shared/types`. |
| B6 | CI local — `npm run typecheck && npm test` antes de cada commit (opcional: pre-commit hook). |
