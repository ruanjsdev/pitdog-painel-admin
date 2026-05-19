import type { Order } from "../types/order"

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_MENU_API_BASE_URL
)?.replace(/\/$/, "")
const streamUrl = import.meta.env.VITE_ORDERS_STREAM_URL

export const hasOrdersBackend = Boolean(apiBaseUrl)

const ordersCacheKey = "pitsdog:admin:orders:v1"
const realtimePollInterval = 2500

type BackendOrderStatus =
  | "ABERTO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "CANCELADO"
  | "FINALIZADO"
  | "PREPARANDO"
  | "PRONTO"
  | "SAIU_PARA_ENTREGA"

type BackendOrderItem = {
  nomeCombo?: string
  nomeProduto?: string
  quantidade?: number
  observacao?: string | null
  adicionais?: Array<{ nomeAdicional?: string }>
  subtotal?: number
}

type BackendOrder = {
  id: number
  numeroPedido?: number
  tipoPedido?: "ENTREGA" | "RETIRADA" | "MESA"
  nomeCliente?: string | null
  telefoneCliente?: string | null
  bairroEntrega?: string | null
  ruaEntrega?: string | null
  numeroCasa?: number | null
  complemento?: string | null
  numeroMesa?: number | null
  formaPagamento?: "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO" | "PIX"
  status?: BackendOrderStatus
  itens?: BackendOrderItem[]
  subtotal?: number
  taxaEntrega?: number
  descontoManualValor?: number | null
  descontoManualPercentual?: number | null
  descontoFidelidadeValor?: number | null
  descontos?: number | null
  total?: number
  momentoPedido?: string
  previsaoRetirada?: string
}

const backendStatusToPanelStatus: Record<BackendOrderStatus, Order["status"]> = {
  ABERTO: "novo",
  AGUARDANDO_APROVACAO: "novo",
  APROVADO: "preparando",
  CANCELADO: "cancelado",
  FINALIZADO: "concluido",
  PREPARANDO: "preparando",
  PRONTO: "saiu",
  SAIU_PARA_ENTREGA: "saiu",
}

const panelStatusToBackendStatus: Record<Order["status"], BackendOrderStatus> = {
  cancelado: "CANCELADO",
  concluido: "FINALIZADO",
  novo: "AGUARDANDO_APROVACAO",
  preparando: "PREPARANDO",
  saiu: "PRONTO",
}

const paymentLabels: Record<string, string> = {
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
}

function formatTime(value?: string) {
  if (!value) return "Agora"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getTimestamp(value?: string) {
  if (!value) return 0

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function mapBackendOrder(order: BackendOrder): Order {
  const createdAt = order.momentoPedido ?? order.previsaoRetirada
  const delivery = order.tipoPedido === "ENTREGA"
    ? "Delivery"
    : order.tipoPedido === "MESA"
      ? "Mesa"
      : "Retirada"
  const address = order.tipoPedido === "MESA"
    ? `Mesa ${order.numeroMesa ?? "-"}`
    : order.tipoPedido === "RETIRADA"
      ? "Retirada no balcão"
      : [
          order.ruaEntrega,
          order.numeroCasa,
          order.bairroEntrega,
          order.complemento,
        ].filter(Boolean).join(", ")

  return {
    address,
    backendId: order.id,
    backendStatus: order.status,
    createdAt,
    createdAtTimestamp: getTimestamp(createdAt),
    customer: order.nomeCliente || (order.tipoPedido === "MESA" ? `Mesa ${order.numeroMesa ?? "-"}` : "Cliente"),
    delivery,
    deliveryFee: order.taxaEntrega,
    discount: order.descontoManualValor ?? order.descontoFidelidadeValor ?? undefined,
    discountPercent: order.descontoManualPercentual ?? undefined,
    id: order.numeroPedido ?? order.id,
    items: (order.itens ?? []).map((item) => {
      const adicionais = item.adicionais?.map((adicional) => adicional.nomeAdicional).filter(Boolean).join(", ")
      const base = `${item.quantidade ?? 1}x ${item.nomeProduto ?? item.nomeCombo ?? "Produto"}`
      const extra = adicionais ? ` + ${adicionais}` : ""
      const obs = item.observacao ? ` (${item.observacao})` : ""

      return `${base}${extra}${obs}`
    }),
    notes: "",
    payment: order.formaPagamento ? paymentLabels[order.formaPagamento] ?? order.formaPagamento : "-",
    phone: order.telefoneCliente ?? "-",
    status: order.status ? backendStatusToPanelStatus[order.status] : "novo",
    subtotal: order.subtotal,
    time: formatTime(createdAt),
    total: order.total ?? 0,
  }
}

function isBackendOrder(order: BackendOrder | Order): order is BackendOrder {
  return "tipoPedido" in order || "nomeCliente" in order || "itens" in order
}

function normalizeOrders(orders: Array<BackendOrder | Order>) {
  return orders
    .map((order) => (isBackendOrder(order) ? mapBackendOrder(order) : order))
    .map((order) => ({
      ...order,
      createdAtTimestamp: order.createdAtTimestamp ?? getTimestamp(order.createdAt),
    }))
    .sort((first, second) => (
      (second.createdAtTimestamp ?? 0) - (first.createdAtTimestamp ?? 0) ||
      (second.backendId ?? second.id) - (first.backendId ?? first.id)
    ))
}

function readCachedOrders() {
  try {
    const cachedOrders = window.localStorage.getItem(ordersCacheKey)

    if (!cachedOrders) return []

    return normalizeOrders(JSON.parse(cachedOrders) as Order[])
  } catch {
    return []
  }
}

function writeCachedOrders(orders: Order[]) {
  try {
    window.localStorage.setItem(ordersCacheKey, JSON.stringify(orders))
  } catch {
    // Cache is only a speed boost; the live API remains the source of truth.
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("Backend URL is not configured.")
  }

  const headers = new Headers(options?.headers)

  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()

  if (!text) return undefined as T

  return JSON.parse(text) as T
}

export const ordersApi = {
  getCachedOrders() {
    return readCachedOrders()
  },

  async listOrders() {
    if (!apiBaseUrl) return []

    const orders = normalizeOrders(await request<BackendOrder[]>("/admin/pedidos"))

    writeCachedOrders(orders)

    return orders
  },

  async updateOrder(id: number, changes: Partial<Order>) {
    if (!apiBaseUrl) return null

    if (changes.status) {
      const backendStatus = panelStatusToBackendStatus[changes.status]

      if (!backendStatus) throw new Error("Status invalido.")

      if (backendStatus === "CANCELADO") {
        await request<void>(`/admin/pedidos/${id}`, {
          method: "DELETE",
        })

        return changes as Order
      }

      return mapBackendOrder(await request<BackendOrder>(`/admin/pedidos/${id}/status`, {
        body: JSON.stringify({ status: backendStatus }),
        method: "PATCH",
      }))
    }

    if (changes.discount !== undefined || changes.discountPercent !== undefined || changes.discountReason !== undefined) {
      return mapBackendOrder(await request<BackendOrder>(`/admin/pedidos/${id}/desconto`, {
        body: JSON.stringify({
          descontoManualPercentual: changes.discountPercent,
          descontoManualValor: changes.discount,
        }),
        method: "PATCH",
      }))
    }

    return changes as Order
  },

  async updateStoreStatus(open: boolean) {
    if (!apiBaseUrl) return null

    void open
    return null
  },

  subscribeOrders(onOrders: (orders: Order[]) => void, onError: () => void) {
    if (streamUrl) {
      const events = new EventSource(streamUrl)

      events.addEventListener("orders", (event) => {
        const orders = normalizeOrders(JSON.parse(event.data) as Array<BackendOrder | Order>)

        writeCachedOrders(orders)
        onOrders(orders)
      })
      events.onerror = onError

      return () => events.close()
    }

    if (!apiBaseUrl) return () => undefined

    const interval = window.setInterval(async () => {
      try {
        onOrders(await ordersApi.listOrders())
      } catch {
        onError()
      }
    }, realtimePollInterval)

    return () => window.clearInterval(interval)
  },
}
