export {}

type PitsDogIpcResult<T = unknown> = {
  data?: T
  error?: string
  message?: string
  ok: boolean
}

type PrinterConfig = {
  autoPrintOnAccept: boolean
  enabled: boolean
  host: string
  port: number
}

declare global {
  interface Window {
    pitsDog?: {
      printer?: {
        checkConnection: () => Promise<PitsDogIpcResult<{ connected: boolean }>>
        getConfig: () => Promise<PitsDogIpcResult<PrinterConfig>>
        printReceiptText: (text: string) => Promise<PitsDogIpcResult>
        saveConfig: (config: PrinterConfig) => Promise<PitsDogIpcResult<PrinterConfig>>
        testPrint: () => Promise<PitsDogIpcResult>
      }
    }
    pitsDogPrinter?: {
      printHtml: (html: string) => Promise<PitsDogIpcResult>
      printReceiptText: (text: string) => Promise<PitsDogIpcResult>
    }
  }
}
