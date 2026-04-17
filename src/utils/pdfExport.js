/**
 * PDF export using window.print() — no external dependency needed.
 * Creates a hidden print-only area, triggers browser print, then cleans up.
 * In Electron this opens the native PDF save dialog.
 */

function generatePrintHTML({ title, filename, headers, data, footer }) {
  const headerRow = headers.map(h => `<th>${h}</th>`).join('');
  const bodyRows = data.map(row =>
    `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`
  ).join('');

  const docTitle = filename ? filename.replace(/\.pdf$/i, '') : title;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${docTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1a1a2e; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #e94560; }
        .header h1 { font-size: 20px; color: #e94560; }
        .header span { font-size: 11px; color: #999; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #e94560; color: #fff; font-weight: 600; }
        tr:nth-child(even) { background: #f8f8f8; }
        .footer { margin-top: 12px; font-size: 12px; color: #e94560; font-weight: 600; }
        @media print {
          body { padding: 10px; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TS Concept PDV — ${title}</h1>
        <span>Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
      </div>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${footer ? `<div class="footer">${footer}</div>` : ''}
    </body>
    </html>
  `;
}

export function exportPDF({ title, headers, data, filename, footer }) {
  const html = generatePrintHTML({ title, filename, headers, data, footer });

  // Create hidden iframe to avoid opening new tab
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.onload = () => {
    iframe.contentWindow.focus();

    // Electron uses the main window's document.title as the default PDF filename
    const originalTitle = document.title;
    const docTitle = filename ? filename.replace(/\.pdf$/i, '') : title;
    document.title = docTitle;

    iframe.contentWindow.print();

    setTimeout(() => {
      document.title = originalTitle;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 5000);
  };
}
