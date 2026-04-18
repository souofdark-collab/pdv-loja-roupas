import { buildPixPayload } from './pix';

const fmt = (v) => `R$ ${Number(v).toFixed(2)}`;

export function buildReceiptHTML({
  sale,
  config = {},
  cliente = null,
  vendedor = null,
  caixa = null,
  payInfo = null,
  reprint = false
}) {
  const empresa = config.empresa_nome || 'TS Concept PDV';
  const baseName = (payInfo && payInfo.paymentMethod) || sale.forma_pagamento || '';
  const parcelas = Number(sale.parcelas) || 0;
  const paymentName = /crédito|credito/i.test(baseName) && parcelas > 1
    ? `${baseName} (${parcelas}x)`
    : baseName;
  const isPix = /pix/i.test(baseName);
  const pixPayload = isPix && config.pix_chave ? buildPixPayload({
    chave: config.pix_chave,
    nome: config.pix_nome || empresa,
    cidade: config.pix_cidade || 'BRASIL',
    valor: sale.total,
    txid: `VENDA${sale.id}`
  }) : '';
  const pixBlock = pixPayload ? `
    <div class="line"></div>
    <p class="center bold">PIX — Pagamento</p>
    <div class="center" id="pix-qr-slot" style="margin:6px 0"></div>
    <p class="center" style="font-size:10px;word-break:break-all">${pixPayload}</p>
    <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
    <script>
      (function(){
        try {
          var qr = qrcode(0, 'M');
          qr.addData(${JSON.stringify(pixPayload)});
          qr.make();
          var slot = document.getElementById('pix-qr-slot');
          if (slot) slot.innerHTML = qr.createImgTag(4, 2);
        } catch(e){}
      })();
    </script>
  ` : '';

  const clienteLine = cliente ? `<p><b>Cliente:</b> ${cliente.nome}${cliente.cpf ? ` | CPF: ${cliente.cpf}` : ''}</p>` : (sale.cliente_nome ? `<p><b>Cliente:</b> ${sale.cliente_nome}</p>` : '');
  const vendedorNome = vendedor ? vendedor.nome : (sale.vendedor_nome || sale.usuario_nome || '');
  const vendedorLine = vendedorNome ? `<p><b>Vendedor:</b> ${vendedorNome}</p>` : '';
  const caixaLine = '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cupom - Venda #${sale.id}</title>
      <style>
        body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .total { font-size: 18px; font-weight: bold; }
        .item { margin: 4px 0; }
        @media print { body { margin: 0; padding: 5px; } }
      </style>
    </head>
    <body>
      <p class="center bold" style="font-size:14px">${empresa}</p>
      ${config.empresa_endereco ? `<p class="center">${config.empresa_endereco}</p>` : ''}
      ${config.empresa_cnpj ? `<p class="center">CNPJ: ${config.empresa_cnpj}</p>` : ''}
      ${config.empresa_contato ? `<p class="center">Tel: ${config.empresa_contato}</p>` : ''}
      <div class="line"></div>
      <p class="center bold">Venda #${sale.id}</p>
      <p>Data: ${new Date(sale.data).toLocaleString('pt-BR')}</p>
      <div class="line"></div>
      ${clienteLine}
      ${vendedorLine}
      ${caixaLine}
      <div class="line"></div>
      ${(sale.itens || []).map(item => `
        <div class="item">
          ${item.produto_nome}${(item.tamanho || item.cor) ? ` (${item.tamanho || '-'}/${item.cor || '-'})` : ''}<br/>
          ${item.quantidade} x ${fmt(item.preco_unitario)} = ${fmt(item.quantidade * item.preco_unitario)}
        </div>
      `).join('')}
      <div class="line"></div>
      <p>Subtotal: ${fmt(sale.subtotal || sale.total)}</p>
      ${Number(sale.desconto) > 0 ? `<p>Desconto: -${fmt(sale.desconto)}</p>` : ''}
      <p class="total">TOTAL: ${fmt(sale.total)}</p>
      <p>Pagamento: ${paymentName}</p>
      ${payInfo && payInfo.cashGiven != null ? `<p>Recebido: ${fmt(payInfo.cashGiven)}</p><p>Troco: ${fmt(payInfo.troco)}</p>` : ''}
      ${pixBlock}
      <div class="line"></div>
      <p class="center">Obrigado pela preferência!</p>
      ${reprint ? '<p class="center" style="font-size:10px">2ª VIA</p>' : ''}
    </body>
    </html>
  `;
}
