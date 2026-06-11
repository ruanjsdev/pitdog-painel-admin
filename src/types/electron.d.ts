export {}

declare global {
  interface Window {
    pitsDogPrinter?: {
      printHtml: (html: string) => Promise<{ ok: boolean }>
      printReceiptText: (text: string) => Promise<{ ok: boolean }>
    }
  }
}
