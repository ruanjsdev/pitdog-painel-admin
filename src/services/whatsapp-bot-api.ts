import type { Order } from "../types/order"

const officialBotUrl = "https://pits-dog-bot.onrender.com"

export type WhatsAppBotStatus = {
  connected: boolean
  connectedAt?: string
  disconnectedAt?: string
  hasSocket: boolean
  lastQrAt?: string
  qrCode?: string
  qrCodeDataUrl?: string
  queuedMessages: number
  sessionDir: string
}

type BotStatusResponse = {
  bot: WhatsAppBotStatus
  error?: string
  ok: boolean
}

export type WhatsAppBotSettings = {
  botActive?: boolean
  greetingCooldownHours?: number
  greetingMessage?: string
  menuLink?: string
  pixKey?: string
  pixReceiverName?: string
}

export function getWhatsAppBotBaseUrl() {
  return officialBotUrl
}

export const whatsappBotBaseUrl = getWhatsAppBotBaseUrl()

function adminHeaders(extraHeaders?: HeadersInit) {
  return new Headers(extraHeaders)
}

export async function fetchWhatsAppBotStatus() {
  const botBaseUrl = getWhatsAppBotBaseUrl()

  if (!botBaseUrl) {
    throw new Error("Informe a URL do bot WhatsApp no painel Zap.")
  }

  const response = await fetch(`${botBaseUrl}/api/bot/status`, {
    headers: adminHeaders(),
  })

  const payload = await response.json().catch(() => null) as BotStatusResponse | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "Não foi possível conectar ao bot WhatsApp.")
  }

  return payload.bot
}

export async function fetchWhatsAppBotSettings() {
  const botBaseUrl = getWhatsAppBotBaseUrl()

  if (!botBaseUrl) {
    throw new Error("Informe a URL do bot WhatsApp no painel Zap.")
  }

  const response = await fetch(`${botBaseUrl}/api/settings`, {
    headers: adminHeaders(),
  })

  const payload = await response.json().catch(() => null) as WhatsAppBotSettings | { error?: string } | null

  if (!response.ok || !payload) {
    throw new Error("Não foi possível carregar as configurações do bot.")
  }

  if ("error" in payload) {
    throw new Error(payload.error ?? "Não foi possível carregar as configurações do bot.")
  }

  return payload as WhatsAppBotSettings
}

export async function saveWhatsAppBotSettings(settings: WhatsAppBotSettings) {
  const botBaseUrl = getWhatsAppBotBaseUrl()

  if (!botBaseUrl) {
    throw new Error("Informe a URL do bot WhatsApp no painel Zap.")
  }

  const response = await fetch(`${botBaseUrl}/api/settings`, {
    body: JSON.stringify(settings),
    headers: adminHeaders({ "Content-Type": "application/json" }),
    method: "POST",
  })

  const payload = await response.json().catch(() => null) as { error?: string; settings?: WhatsAppBotSettings } | null

  if (!response.ok || !payload?.settings) {
    throw new Error(payload?.error ?? "Não foi possível salvar as configurações do bot.")
  }

  return payload.settings
}

function parseOrderItem(item: string) {
  const quantityMatch = item.match(/^(\d+)\s*x\s*/i)
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1
  const withoutQuantity = item.replace(/^(\d+)\s*x\s*/i, "").trim()
  const noteMatch = withoutQuantity.match(/\(([^()]*)\)\s*$/)
  const observation = noteMatch?.[1]?.trim() ?? ""
  const cleanItem = observation ? withoutQuantity.replace(/\s*\([^()]*\)\s*$/, "").trim() : withoutQuantity
  const [name = item, ...additions] = cleanItem.split(" + ")

  return {
    additions: additions.map((addition) => ({ name: addition.trim() })).filter((addition) => addition.name),
    name: name.trim() || item,
    observation,
    quantity,
  }
}

export async function notifyWhatsAppOrderStatus(event: string, order: Order) {
  const cleanPhone = order.phone.replace(/\D/g, "")
  const botBaseUrl = getWhatsAppBotBaseUrl()

  if (!cleanPhone || !botBaseUrl) return null

  const response = await fetch(`${botBaseUrl}/api/notify-order`, {
    body: JSON.stringify({
      event,
      order: {
        code: order.id,
        customerName: order.customer,
        customerPhone: cleanPhone,
        delivery: order.delivery,
        items: order.items.map(parseOrderItem),
        payment: order.payment,
        total: order.total,
      },
    }),
    headers: adminHeaders({ "Content-Type": "application/json" }),
    method: "POST",
  })

  const payload = await response.json().catch(() => null) as { error?: string; ok?: boolean } | null

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "Não foi possível enviar a mensagem no WhatsApp.")
  }

  return payload
}
