const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  print: (content) => ipcRenderer.invoke('dialog:print', content),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (html, printerName) => ipcRenderer.invoke('print-receipt', html, printerName)
});

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

contextBridge.exposeInMainWorld('api', {
  get: async (url) => {
    const res = await fetch(`http://localhost:3001${url}`);
    return handleResponse(res);
  },
  post: async (url, body) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  put: async (url, body) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return handleResponse(res);
  },
  delete: async (url, body) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: 'DELETE',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return handleResponse(res);
  }
});
