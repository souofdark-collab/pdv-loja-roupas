# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos

```bash
# Desenvolvimento (mata processos antigos primeiro)
powershell -Command "Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force"
npm run dev

# Build para produção
npm run build          # build do frontend (Vite → dist/)
npm run electron:build # build completo + instalador (electron-builder → release/)
```

**Login padrão:** `admin` / `admin123`

---

## GitHub — Fluxo de Atualização

Após qualquer alteração de código, commitar e subir para o GitHub automaticamente:

```bash
git add -p                          # revisar alterações (ou git add <arquivo>)
git commit -m "descrição da mudança"
git push origin main
```

**Regras:**
- Sempre criar um novo commit após cada conjunto de mudanças — nunca usar `--amend` em commits já publicados
- Mensagem de commit deve descrever o **porquê** da mudança, não o que foi alterado
- Nunca usar `--force` no push para `main`
- Se o repositório ainda não tiver remote configurado: `git remote add origin <url-do-repo>`

---

## Arquitetura

```
pdv-loja-roupas/
├── src/                        # Frontend React
│   ├── App.jsx                 # Roteamento, estado global (user, theme), VendasVendas modal
│   ├── index.css               # Variáveis CSS globais (tema dark, cores customizáveis)
│   ├── components/
│   │   └── Layout.jsx          # Sidebar com menu de navegação + badge estoque baixo
│   ├── pages/                  # Uma página por rota
│   │   ├── Login.jsx
│   │   ├── PDV.jsx             # Ponto de venda principal
│   │   ├── Vendas.jsx          # Histórico de vendas + cancelamento + reimpressão
│   │   ├── Produtos.jsx
│   │   ├── Estoque.jsx
│   │   ├── Clientes.jsx
│   │   ├── Promocoes.jsx       # Promoções com regras por produto ou categoria
│   │   ├── Despesas.jsx
│   │   ├── FechamentoCaixa.jsx # Relatório diário/quinzenal/mensal
│   │   ├── Trocas.jsx
│   │   ├── Relatorios.jsx
│   │   ├── Auditoria.jsx
│   │   ├── Usuarios.jsx
│   │   ├── Configuracoes.jsx   # Tema, cores, formas de pagamento, dados da empresa, impressora
│   │   └── Backup.jsx          # Export/import/wipe do banco
│   └── utils/
│       └── pdfExport.js        # Geração de PDF via window.print() em iframe oculto
│
├── electron/
│   ├── main.js                 # Entry point Electron + Express server (porta 3001) + IPC handlers
│   ├── preload.js              # Bridge window.api → fetch localhost:3001 + window.electron (IPC)
│   └── api/
│       ├── db.js               # Banco JSON em memória (lê/salva arquivos .json)
│       └── routes/             # Uma rota por domínio
│           ├── auth.js         # POST /api/login (registra log de acesso)
│           ├── backup.js       # GET /api/backup/export, POST /api/backup/restore, POST /api/backup/wipe
│           ├── vendas.js       # CRUD vendas + venda_itens + controle estoque + log
│           ├── estoque.js      # CRUD estoque + movimentações + validação saída negativa + log
│           ├── produtos.js     # CRUD produtos + unicidade código de barras + log
│           ├── clientes.js
│           ├── categorias.js
│           ├── promocoes.js
│           ├── despesas.js
│           ├── usuarios.js
│           ├── trocas.js
│           ├── caixa.js        # Abertura/fechamento de caixa + log
│           ├── relatorios.js   # GET /api/relatorios/fechamento
│           ├── auditoria.js    # GET/POST /api/auditoria (tabela log_acoes)
│           └── configuracoes.js
│
├── vite.config.js              # Apenas react() — SEM vite-plugin-electron
└── package.json
```

---

## Stack

- **Frontend:** React 18 + React Router 6, Vite 6
- **Desktop:** Electron 33
- **Backend local:** Express (roda na porta 3001 dentro do Electron)
- **Banco:** Arquivos JSON em `%APPDATA%\pdv-loja-roupas\` (sem SQLite)
- **Auth:** bcryptjs para hash de senhas
- **PDF:** `window.print()` via iframe oculto (sem biblioteca)
- **Impressão direta:** `ipcMain.handle('print-receipt', ...)` → `webContents.print()` silencioso

---

## Banco de Dados

**Localização:** `%APPDATA%\pdv-loja-roupas\<tabela>.json`

**Tabelas:**
`usuarios`, `clientes`, `categorias`, `produtos`, `estoque`, `estoque_movimentacoes`, `vendas`, `venda_itens`, `promocoes`, `promocoes_regras`, `despesas_categorias`, `despesas`, `configuracoes`, `formas_pagamento`, `trocas`, `historico_precos`, `log_acoes`, `abertura_caixa`

**API do db (electron/api/db.js):**
```js
db.select(table, where)     // filtra por igualdade
db.findOne(table, where)
db.insert(table, data)      // retorna { lastInsertRowid }
db.update(table, id, data)
db.delete(table, id)
db._data[table]             // acesso direto (usado no backup)
db._save(table)             // persiste para JSON
```

**Atenção:** `db.findOne('usuarios', { login, ativo: 1 })` — o campo `ativo` deve ser `1` (número), não `true`. Se o admin não consegue logar, verificar `%APPDATA%\pdv-loja-roupas\usuarios.json` e confirmar `"ativo": 1`.

**Backups automáticos:** `%APPDATA%\pdv-loja-roupas\backups-auto\` — gerado ao iniciar o app e a cada 24h, mantém os últimos 7.

---

## Como o Dev funciona

`vite-plugin-electron` foi **removido** do `vite.config.js` porque causava dupla instância do Electron (o plugin spawna Electron como filho do processo Vite, e o concurrently também iniciava `electron .`).

Fluxo atual:
1. `vite` sobe o frontend em `:5173`
2. `wait-on` aguarda `:5173` ficar disponível
3. `electron .` carrega `electron/main.js` (via `"main"` no package.json)
4. `main.js` inicia Express em `:3001` com todas as rotas
5. Electron abre janela carregando `http://localhost:5173`

**Se travar com "Outra instância já está rodando":** matar processos com `powershell -Command "Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force"` antes de `npm run dev`.

---

## Bridge Frontend ↔ API

`electron/preload.js` expõe dois objetos globais:

**`window.api`** — fetch para o Express em `:3001`:
```js
window.api.get(url)
window.api.post(url, body)
window.api.put(url, body)
window.api.delete(url, body)   // body é opcional (suporta corpo no DELETE)
```
Erros HTTP retornam `throw` com `.status` no objeto de erro.

**`window.electron`** — IPC direto com o processo principal:
```js
window.electron.getPrinters()                    // lista impressoras instaladas
window.electron.printReceipt(html, printerName)  // imprime silenciosamente
window.electron.print(content)                   // legado
```

---

## Tema e Cores

`applyTheme()` em `src/App.jsx` aplica variáveis CSS no `:root`. É chamado no boot e ao salvar configurações.

| Config salva | Variável CSS |
|---|---|
| `cor_accent` | `--accent` |
| `cor_bg` | `--bg-primary` |
| `cor_bg_secondary` | `--bg-secondary` (sidebar) |
| `cor_card` | `--bg-card` |
| `cor_text` | `--text-primary`, `--text-secondary` |
| `cor_btn` | `--btn-bg` |

Botões primários usam `background: var(--btn-bg, var(--accent))`.

---

## Funcionalidades Implementadas

### PDV (src/pages/PDV.jsx)
- Busca de produtos em **modal dedicado** (não dropdown inline) — evita poluição visual com muitos produtos
- Modal de busca tem: input com autofoco, filtros por categoria em pills, lista com tamanho/cor/estoque disponível
- Promoções por produto aplicadas automaticamente ao adicionar ao carrinho
- `aplicavel_a === 'produto'` → verifica `promocoes_regras` com `produto_id` correspondente
- Item do carrinho guarda `preco_original` e `promo_aplicada`; mostra badge com preço riscado
- `descontoPromocao` ignora promoções `aplicavel_a === 'produto'` (já embutidas no preço)
- Botão 📦 abre modal "Aguardando Leitura" para leitor de código de barras
- Fechar PDV com itens no carrinho exige confirmação (`pdvCartRef` + `handleClosePDV` em App.jsx)
- Desconto manual: validação ao trocar tipo (% ↔ R$) recalcula/limita o valor atual
- **Recibo** inclui: nome/endereço/CNPJ/telefone da empresa + CPF do cliente (se cadastrado)
- **Impressão**: se `config.impressora_padrao` definido → `window.electron.printReceipt()` silencioso; caso contrário → `window.open` com diálogo do sistema

### Vendas (src/pages/Vendas.jsx e src/App.jsx)
- Modal de histórico com tabela `minWidth: 900`, modais com `maxWidth: 1200, width: 95vw`
- Cancelamento requer: motivo (textarea obrigatório) + autenticação de admin
- `motivo_cancelamento` salvo na venda e no `log_acoes`
- Botão "Imprimir" em cada linha + botão "Reimprimir" no modal de detalhes
- Em `App.jsx`: componente `VendasVendas` com modal de cancelamento inline

### Backup (src/pages/Backup.jsx + electron/api/routes/backup.js)
- **Export:** `GET /api/backup/export` retorna dados brutos de TODAS as tabelas
- **Import:** `POST /api/backup/restore` restaura todas as tabelas diretamente no `db._data`
- **Wipe:** `POST /api/backup/wipe` — exige login do admin principal (menor ID entre admins)

### Fechamento de Caixa (src/pages/FechamentoCaixa.jsx)
- Períodos: Diário, Quinzenal (1ª/2ª), Mensal
- Rota: `GET /api/relatorios/fechamento?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD`

### Auditoria (src/pages/Auditoria.jsx)
- Registra automaticamente: Login, Nova Venda, Cancelamento de Venda, Entrada/Saída/Ajuste de Estoque, Produto Cadastrado, Produto Desativado, Alteração de Preço, Abertura/Fechamento de Caixa

### Configurações (src/pages/Configuracoes.jsx)
- Abas: Dados da Empresa, Tema e Cores, Formas de Pagamento, **Impressora**
- Aba Impressora: lista impressoras via `window.electron.getPrinters()`, seleção salva como `impressora_padrao` nas configurações, botão "Imprimir Teste"

### Estoque (src/pages/Estoque.jsx)
- Edição salva `tamanho` e `cor` além de `quantidade` e `minimo` (bug anterior ignorava tamanho/cor)
- Saída manual valida estoque não negativo (retorna 400 se insuficiente)

### Promoções (src/pages/Promocoes.jsx)
- Formulário só abre após regras carregarem do servidor (`setShowForm(true)` dentro do `.then()`)
- `produto_id` e `categoria_id` das regras convertidos para `Number()` ao salvar

### Relatórios (src/pages/Relatorios.jsx)
- Export CSV com escape correto de caracteres especiais (vírgulas, aspas, quebras de linha)

---

## Problemas Conhecidos / Histórico de Bugs

### Dupla instância Electron (RESOLVIDO)
`vite-plugin-electron` + `electron .` no concurrently causavam dois processos Electron disputando porta 3001. Fix: remover `vite-plugin-electron` do `vite.config.js`.

### Admin com `ativo: 0` (RESOLVIDO)
Após restore/wipe parcial, o campo `ativo` do admin pode ficar `0`, impedindo login. `db.init()` em `db.js` agora corrige isso automaticamente ao iniciar.

### Login falha após restore com backup antigo (RESOLVIDO)
`GET /api/usuarios` remove `senha_hash` por segurança. Após restore, `bcrypt.compareSync` jogava `Illegal arguments: string, undefined`.
Fixes: (1) `auth.js` verifica `!user.senha_hash` antes do compareSync; (2) `db.init()` recria hash com `admin123` se ausente.

### Despesas: categoria e recorrência mostrando "-" (RESOLVIDO)
`categoria_id` salvo como string pelo `<select>`, comparação usava `===` com `c.id` (número). Fix: `Number(categoria_id)` no insert/update/find de `despesas.js`. Recorrência `'nenhuma'` não era tratada em `recorrenciaLabel`.

### useEffect com variável em temporal dead zone → tela branca (RESOLVIDO, RECORRENTE)
**Regra crítica:** todo `useEffect` que referencia um state ou ref deve ser declarado DEPOIS do `useState`/`useRef` correspondente. O array de dependências é avaliado imediatamente durante o render — se a variável ainda não foi declarada, lança ReferenceError e o componente fica em branco.
Já ocorreu 3 vezes: `barcodeMode` em PDV.jsx, `barcodeMode` em Produtos.jsx, `showProductModal` em PDV.jsx.

### Backup incompleto antes de 2026-04-17 (RESOLVIDO)
Versões antigas exportavam via rotas individuais e perdiam `venda_itens`, `log_acoes`, `historico_precos`, `abertura_caixa`. Backup agora usa `GET /api/backup/export` que lê `db._data` direto.

### produtos.js: rota /produtos/buscar inacessível (RESOLVIDO)
`GET /produtos/buscar` estava definido após `GET /produtos/:id`. O Express interceptava com `id="buscar"` → 404. Fix: mover `/produtos/buscar` para antes de `/produtos/:id`.

### vendas.js PUT: forma_pagamento sobrescrita com undefined (RESOLVIDO)
Ao cancelar uma venda sem enviar `forma_pagamento` no body, o campo era sobrescrito com `undefined`. Fix: `forma_pagamento: forma_pagamento || venda?.forma_pagamento`.

### Estoque: tamanho/cor não salvos ao editar (RESOLVIDO)
`handleSubmit` em Estoque.jsx enviava apenas `quantidade` e `minimo`. Rota PUT também só aceitava esses campos. Fix: incluir `tamanho` e `cor` em ambos.

---

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/login` | Autenticação + log de acesso |
| GET | `/api/backup/export` | Export raw de todas as tabelas |
| POST | `/api/backup/restore` | Restore completo |
| POST | `/api/backup/wipe` | Limpar banco (só admin principal) |
| GET | `/api/vendas` | Lista vendas (aceita `?inicio=&fim=`) |
| POST | `/api/vendas` | Criar venda + baixar estoque + log |
| PUT | `/api/vendas/:id` | Cancelar/atualizar venda |
| GET | `/api/vendas/:id` | Detalhes da venda com itens |
| GET | `/api/estoque` | Lista estoque com `produto_nome` |
| PUT | `/api/estoque/:id` | Atualiza quantidade, mínimo, tamanho e cor |
| POST | `/api/estoque/movimentacao` | Entrada/saída/ajuste manual + log |
| GET | `/api/relatorios/fechamento` | Fechamento de caixa (range de datas) |
| GET | `/api/auditoria` | Log de ações (tabela `log_acoes`) |
| GET | `/api/caixa/atual` | Abertura de caixa em aberto |
| POST | `/api/caixa/abertura` | Abrir caixa + log |
| PUT | `/api/caixa/fechamento/:id` | Fechar caixa + log |
| GET | `/api/promocoes/ativas` | Promoções ativas com regras |
| GET | `/api/produtos/buscar` | Busca por nome/código (deve ficar ANTES de `/produtos/:id`) |

## IPC Electron (main.js)

| Handler | Descrição |
|---------|-----------|
| `get-printers` | Retorna `mainWindow.webContents.getPrintersAsync()` |
| `print-receipt` | Cria BrowserWindow oculta, carrega HTML, imprime com `silent: true` para `deviceName` |
| `dialog:print` | Legado (sem uso real) |
