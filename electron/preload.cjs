const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pitsDogPrinter", {
  printHtml: (html) => ipcRenderer.invoke("pitsdog:print-html", html),
  printReceiptText: (text) => ipcRenderer.invoke("pitsdog:print-receipt-text", text)
});
