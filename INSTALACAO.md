# Guia de Instalação — TS Concept PDV

## Opção 1: Instalar pelo Instalador (Usuário Final)

### Pré-requisitos
- Windows 10 ou 11 (64-bit)
- Nenhum software adicional necessário

### Passos
1. Copie o arquivo `TS Concept PDV Setup x.x.x.exe` (gerado em `release/`) para a máquina destino
2. Execute o instalador com duplo clique
3. Siga as instruções na tela (próximo → instalar → concluir)
4. O atalho **TS Concept PDV** aparecerá na Área de Trabalho e no Menu Iniciar
5. Abra o programa e faça login com:
   - **Usuário:** `admin`
   - **Senha:** `admin123`

> **Troque a senha do admin imediatamente** em *Usuários → Editar* após o primeiro acesso.

---

## Opção 2: Gerar o Instalador (Desenvolvedor)

### Pré-requisitos
- [Node.js 18+](https://nodejs.org) instalado
- Git (opcional, apenas para clonar)

### Passos
```bash
# 1. Clone ou copie o projeto para a máquina de build
git clone <repositorio> pdv-loja-roupas
cd pdv-loja-roupas

# 2. Instale as dependências
npm install

# 3. Gere o build do frontend e o instalador
npm run build
npm run electron:build
```

O instalador ficará em `release/TS Concept PDV Setup x.x.x.exe`.  
Distribua esse arquivo para as máquinas onde o sistema será instalado.

---

## Onde os Dados São Armazenados

Todos os dados ficam em:
```
C:\Users\<usuário>\AppData\Roaming\pdv-loja-roupas\
```

Arquivos principais:
| Arquivo | Conteúdo |
|---|---|
| `usuarios.json` | Usuários e senhas |
| `produtos.json` | Cadastro de produtos |
| `estoque.json` | Estoque por tamanho/cor |
| `vendas.json` + `venda_itens.json` | Histórico de vendas |
| `clientes.json` | Cadastro de clientes |
| `configuracoes.json` | Configurações do sistema |
| `backups-auto/` | Backups automáticos (últimos 7) |

---

## Configuração Inicial (Primeira Vez)

1. **Dados da empresa:** Menu *Configurações → Empresa* — preencha nome, endereço, CNPJ e telefone (aparecem no recibo)
2. **Impressora:** Menu *Configurações → Impressora* — clique em "Buscar Impressoras", selecione a impressora de cupom e salve
3. **Formas de pagamento:** Menu *Configurações → Pagamentos* — ative/desative conforme necessário
4. **Categorias e produtos:** Cadastre em *Produtos* antes de usar o PDV
5. **Estoque inicial:** Cadastre em *Estoque → Novo Item* com as quantidades iniciais
6. **Usuários adicionais:** Crie em *Usuários* com perfil Caixa ou Admin conforme necessário

---

## Migração de Dados (de outra máquina)

### Exportar da máquina antiga
1. Abra o sistema na máquina antiga
2. Vá em *Backup → Exportar Backup*
3. Salve o arquivo `.json` gerado (ex.: em pen drive ou nuvem)

### Importar na máquina nova
1. Instale e abra o sistema normalmente na máquina nova (faça login com admin/admin123)
2. Vá em *Backup → Importar Backup*
3. Selecione o arquivo `.json` exportado
4. O sistema restaurará todos os dados (produtos, clientes, vendas, configurações)
5. Reinicie o aplicativo após a importação

---

## Backup e Recuperação

- **Backup automático:** gerado automaticamente ao abrir o sistema e a cada 24h
  - Local: `%APPDATA%\pdv-loja-roupas\backups-auto\`
  - Mantém os últimos 7 backups
- **Backup manual:** *Backup → Exportar Backup* — recomendado antes de qualquer atualização

---

## Atualização do Sistema

1. Feche o sistema na máquina
2. Faça backup dos dados (*Backup → Exportar*)
3. Execute o novo instalador — ele substituirá a versão anterior automaticamente
4. Os dados em `%APPDATA%\pdv-loja-roupas\` são preservados durante a atualização

---

## Solução de Problemas

### O sistema não abre / fica carregando
Pode haver um processo travado da sessão anterior. Abra o **Gerenciador de Tarefas** (Ctrl+Shift+Esc), encerre processos `electron.exe` e `node.exe` se existirem, depois abra o sistema novamente.

### "Porta 3001 já está em uso"
Outro processo está usando a porta. Encerre `node.exe` pelo Gerenciador de Tarefas ou reinicie o computador.

### Não consigo fazer login com admin/admin123
O arquivo de usuários pode estar corrompido. Verifique `%APPDATA%\pdv-loja-roupas\usuarios.json` e confirme que o admin tem `"ativo": 1` (número, não `true`).

### Impressora não aparece na lista
- Certifique-se de que a impressora está instalada no Windows e aparece em *Dispositivos e Impressoras*
- Clique em "Buscar Impressoras" novamente após instalar o driver
- Para impressoras térmicas USB, instale o driver do fabricante antes de buscar

### Recibo não imprime silenciosamente
Verifique se uma impressora foi selecionada em *Configurações → Impressora*. Se nenhuma estiver configurada, o sistema abre uma janela de impressão padrão do Windows como alternativa.

---

## Requisitos de Sistema

| Item | Mínimo |
|---|---|
| Sistema Operacional | Windows 10 64-bit |
| Processador | Intel/AMD dual-core 1.8 GHz |
| Memória RAM | 4 GB |
| Espaço em disco | 300 MB (instalação) + espaço para dados |
| Resolução | 1024 × 600 |
| Conexão | Não necessária (sistema 100% offline) |
