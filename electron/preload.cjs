const { contextBridge, ipcRenderer } = require("electron");

const printer = {
  checkConnection: () => ipcRenderer.invoke("pitsdog:printer-check-connection"),
  getConfig: () => ipcRenderer.invoke("pitsdog:printer-get-config"),
  printReceiptText: (text) => ipcRenderer.invoke("pitsdog:print-receipt-text", text),
  saveConfig: (config) => ipcRenderer.invoke("pitsdog:printer-save-config", config),
  testPrint: () => ipcRenderer.invoke("pitsdog:printer-test")
};

contextBridge.exposeInMainWorld("pitsDog", {
  isDesktop: true,
  printer
});

contextBridge.exposeInMainWorld("pitsDogPrinter", {
  checkConnection: printer.checkConnection,
  getConfig: printer.getConfig,
  printHtml: (html) => ipcRenderer.invoke("pitsdog:print-html", html),
  printReceiptText: printer.printReceiptText,
  saveConfig: printer.saveConfig,
  testPrint: printer.testPrint
});
