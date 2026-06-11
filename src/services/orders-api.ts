import type { Order } from "../types/order"
import { readOrdersCache } from "../lib/order-sync"
import { adminApiBaseUrl, adminRequest } from "./admin-api"

export const hasOrdersBackend = Boolean(adminApiBaseUrl)

function getPositiveNumber(value: unknown, fallback: number) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const realtimePollInterval = getPositiveNumber(import.meta.env.VITE_ORDERS_POLL_INTERVAL_MS, 700)
const orderHydrationWindowMs = getPositiveNumber(import.meta.env.VITE_ORDER_ITEMS_HYDRATION_WINDOW_MS, 18 * 60 * 60 * 1000)
const maxHydratedOrdersPerPoll = getPositiveNumber(import.meta.env.VITE_ORDER_ITEMS_HYDRATION_LIMIT, 3)

type BackendOrderStatus =
  | "ABERTO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "CANCELADO"
  | "CONCLUIDO"
  | "EM_PREPARO"
  | "FINALIZADO"
  | "PREPARANDO"
  | "PRONTO"
  | "PRONTO_PARA_RETIRADA"
  | "SAIU_PARA_ENTREGA"

type BackendPaymentStatus = "PENDENTE" | "CONFIRMADO" | "CANCELADO"
type BackendPaymentMethod = "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO" | "PIX"

type BackendOrderItem = {
  id?: number
  combo?: { nome?: string; nomeCombo?: string; comboNome?: string }
  item?: { nome?: string }
  nome?: string
  nomeItem?: string
  nomeCombo?: string
  nomeProduto?: string
  descricao?: string
  produto?: { nome?: string; nomeProduto?: string; produtoNome?: string }
  produtoNome?: string
  comboNome?: string
  quantidade?: number
  quantidadeProduto?: number
  qtd?: number
  quantity?: number
  flavorName?: string | null
  flavorNames?: string[] | null
  flavorId?: string | number | null
  flavorIds?: Array<string | number> | null
  sabor?: string | null
  saborNome?: string | null
  sabores?: string[] | null
  observacao?: string | null
  observacoes?: string | null
  obs?: string | null
  adicionais?: Array<{
    adicional?: { nome?: string; nomeAdicional?: string; nomedAicional?: string }
    nome?: string
    nomeAdicional?: string
    nomedAicional?: string
  }>
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
  formaPagamento?: BackendPaymentMethod
  status?: BackendOrderStatus
  statusPagamento?: BackendPaymentStatus
  pagamentoConfirmado?: boolean
  momentoPagamentoConfirmado?: string | null
  trocoPara?: number | null
  valorTroco?: number | null
  itens?: BackendOrderItem[] | { content?: BackendOrderItem[] }
  itensPedido?: BackendOrderItem[] | { content?: BackendOrderItem[] }
  items?: BackendOrderItem[] | { content?: BackendOrderItem[] }
  pedidoItens?: BackendOrderItem[] | { content?: BackendOrderItem[] }
  produtos?: BackendOrderItem[] | { content?: BackendOrderItem[] }
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
  APROVADO: "aprovado",
  CANCELADO: "cancelado",
  CONCLUIDO: "concluido",
  EM_PREPARO: "preparando",
  FINALIZADO: "finalizado",
  PREPARANDO: "preparando",
  PRONTO: "pronto",
  PRONTO_PARA_RETIRADA: "pronto",
  SAIU_PARA_ENTREGA: "saiu",
}

const panelStatusToBackendStatus: Record<Order["status"], BackendOrderStatus> = {
  cancelado: "CANCELADO",
  concluido: "CONCLUIDO",
  finalizado: "FINALIZADO",
  novo: "AGUARDANDO_APROVACAO",
  aprovado: "EM_PREPARO",
  preparando: "EM_PREPARO",
  pronto: "PRONTO_PARA_RETIRADA",
  saiu: "SAIU_PARA_ENTREGA",
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

function calculateBackendTotal(order: BackendOrder) {
  if (order.subtotal === undefined) return order.total ?? 0

  const subtotal = order.subtotal
  const deliveryFee = order.taxaEntrega ?? 0
  const percentageDiscount = order.descontoManualPercentual
    ? subtotal * (order.descontoManualPercentual / 100)
    : 0
  const discount = order.descontos ??
    order.descontoManualValor ??
    order.descontoFidelidadeValor ??
    percentageDiscount

  return Number(Math.max(0, subtotal + deliveryFee - discount).toFixed(2))
}

function getBackendOrderItems(order: BackendOrder) {
  const possibleItems = order.itens ?? order.itensPedido ?? order.items ?? order.pedidoItens ?? order.produtos ?? []

  if (Array.isArray(possibleItems)) return possibleItems

  return Array.isArray(possibleItems.content) ? possibleItems.content : []
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
    items: getBackendOrderItems(order).map((item) => {
      const itemName =
        item.nomeProduto ??
        item.produtoNome ??
        item.produto?.nomeProduto ??
        item.produto?.produtoNome ??
        item.produto?.nome ??
        item.nomeCombo ??
        item.comboNome ??
        item.combo?.nomeCombo ??
        item.combo?.comboNome ??
        item.combo?.nome ??
        item.nomeItem ??
        item.item?.nome ??
        item.nome ??
        item.descricao ??
        "Produto"
      const adicionais = item.adicionais
        ?.map((adicional) =>
          adicional.nomeAdicional ??
          adicional.nomedAicional ??
          adicional.nome ??
          adicional.adicional?.nomeAdicional ??
          adicional.adicional?.nomedAicional ??
          adicional.adicional?.nome
        )
        .filter(Boolean)
        .join(", ")
      const quantity = item.quantidade ?? item.quantidadeProduto ?? item.qtd ?? item.quantity ?? 1
      const base = `${quantity}x ${itemName}`
      const extra = adicionais ? ` + ${adicionais}` : ""
      const flavorNames = [
        ...(Array.isArray(item.flavorNames) ? item.flavorNames : []),
        ...(Array.isArray(item.sabores) ? item.sabores : []),
        item.flavorName,
        item.saborNome,
        item.sabor,
      ].filter(Boolean)
      const flavorText = flavorNames.length > 0 ? ` | Sabor: ${flavorNames.join(", ")}` : ""
      const observation = item.observacao ?? item.observacoes ?? item.obs
      const obs = observation ? ` (${observation})` : ""

      return `${base}${extra}${flavorText}${obs}`
    }),
    notes: "",
    payment: order.formaPagamento ? paymentLabels[order.formaPagamento] ?? order.formaPagamento : "-",
    backendPaymentMethod: order.formaPagamento,
    paymentConfirmed: order.pagamentoConfirmado ?? false,
    paymentConfirmedAt: order.momentoPagamentoConfirmado ?? undefined,
    paymentStatus: order.statusPagamento ?? "PENDENTE",
    paymentChangeFor: order.trocoPara ?? undefined,
    paymentChangeValue: order.valorTroco ?? undefined,
    needsChange: order.formaPagamento === "DINHEIRO" && order.trocoPara !== null && order.trocoPara !== undefined,
    changeFor: order.trocoPara ?? undefined,
    phone: order.telefoneCliente ?? "-",
    status: order.status ? backendStatusToPanelStatus[order.status] : "novo",
    subtotal: order.subtotal,
    time: formatTime(createdAt),
    total: calculateBackendTotal(order),
  }
}

function isBackendOrder(order: BackendOrder | Order): order is BackendOrder {
  const possibleItems = (order as BackendOrder).items

  return (
    "tipoPedido" in order ||
    "nomeCliente" in order ||
    "numeroPedido" in order ||
    "formaPagamento" in order ||
    "itens" in order ||
    "itensPedido" in order ||
    "pedidoItens" in order ||
    (Array.isArray(possibleItems) && possibleItems.some((item) => typeof item === "object")) ||
    (typeof possibleItems === "object" && possibleItems !== null && !Array.isArray(possibleItems) && "content" in possibleItems)
  )
}

function normalizeOrders(orders: Array<BackendOrder | Order>) {
  if (!Array.isArray(orders)) {
    console.warn("[orders-api] normalizeOrders received non-array payload:", orders);
    return [];
  }

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

function orderHasItems(order: Order) {
  return Array.isArray(order.items) && order.items.length > 0
}

async function hydrateOrderItems(order: Order, signal?: AbortSignal) {
  if (orderHasItems(order)) return order

  const backendId = order.backendId ?? order.id

  try {
    const detailedOrder = mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${backendId}`, {
      signal,
    }))

    return orderHasItems(detailedOrder) ? { ...order, ...detailedOrder } : order
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error

    console.warn(`[orders-api] Não foi possível carregar itens do pedido #${order.id}.`, error)
    return order
  }
}

async function hydrateOrdersItems(orders: Order[], signal?: AbortSignal) {
  const now = Date.now()
  const ordersWithoutItems = orders.filter((order) => {
    if (orderHasItems(order)) return false

    const timestamp = order.createdAtTimestamp ?? getTimestamp(order.createdAt)

    return timestamp === 0 || now - timestamp <= orderHydrationWindowMs
  })

  if (ordersWithoutItems.length === 0) return orders

  const missingItemKeys = new Set(
    ordersWithoutItems
      .slice(0, maxHydratedOrdersPerPoll)
      .map((order) => order.backendId ?? order.id)
  )
  const hydratedOrders = await Promise.all(orders.map((order) => (
    missingItemKeys.has(order.backendId ?? order.id) ? hydrateOrderItems(order, signal) : order
  )))

  return hydratedOrders.sort((first, second) => (
    (second.createdAtTimestamp ?? 0) - (first.createdAtTimestamp ?? 0) ||
    (second.backendId ?? second.id) - (first.backendId ?? first.id)
  ))
}

export const ordersApi = {
  getCachedOrders() {
    return readOrdersCache()
  },

  async listOrders(options?: { signal?: AbortSignal }) {
    if (!adminApiBaseUrl) return []

    const response = await adminRequest<any>("/admin/pedidos", {
      signal: options?.signal,
    })

    // Trata resposta paginada (response.content) ou array direto
    const orders = Array.isArray(response) ? response : (response?.content || [])
    return hydrateOrdersItems(normalizeOrders(orders), options?.signal)
  },

  async reprintOrder(id: number) {
    // Lógica para disparar a re-impressão
    console.log(`[printer] Solicitando re-impressão do pedido: ${id}`);
    return adminRequest(`/admin/pedidos/${id}/imprimir`, {
      method: "POST",
    });
  },

  async assignDriver(orderId: number, driverId: number) {
    return adminRequest(`/admin/pedidos/${orderId}/entregador`, {
      body: JSON.stringify({ entregadorId: driverId }),
      method: "PATCH",
    });
  },

  async updateOrder(id: number, changes: Partial<Order>) {
    if (!adminApiBaseUrl) return null

    if (changes.status) {
      const backendStatus =
        changes.backendStatus && changes.backendStatus in backendStatusToPanelStatus
          ? changes.backendStatus as BackendOrderStatus
          : panelStatusToBackendStatus[changes.status]

      if (!backendStatus) throw new Error("Status invalido.")

      return mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${id}/status`, {
        body: JSON.stringify({ status: backendStatus }),
        method: "PATCH",
      }))
    }

    if (changes.discount !== undefined || changes.discountPercent !== undefined || changes.discountReason !== undefined) {
      return mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${id}/desconto`, {
        body: JSON.stringify({
          descontoManualPercentual: changes.discountPercent,
          descontoManualValor: changes.discount,
        }),
        method: "PATCH",
      }))
    }

    return changes as Order
  },

  async restoreOrder(id: number) {
    if (!adminApiBaseUrl) return null

    return mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${id}/restaurar`, {
      method: "PATCH",
    }))
  },

  async updateItemQuantity(orderId: number, itemId: number, quantidade: number) {
    if (!adminApiBaseUrl) return null

    return mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${orderId}/itens/${itemId}/quantidade`, {
      body: JSON.stringify({ quantidade }),
      method: "PATCH",
    }))
  },

  async updateItemObservation(orderId: number, itemId: number, observacao: string) {
    if (!adminApiBaseUrl) return null

    return mapBackendOrder(await adminRequest<BackendOrder>(`/admin/pedidos/${orderId}/itens/${itemId}/observacao`, {
      body: JSON.stringify({ observacao }),
      method: "PATCH",
    }))
  },

  async updateStoreStatus(open: boolean) {
    if (!adminApiBaseUrl) return null

    return adminRequest("/admin/loja/status", {
      body: JSON.stringify({
        aceitaEntrega: open,
        aceitaMesa: open,
        aceitaRetirada: open,
        aberta: open,
        estadoOperacao: open ? "ABERTA" : "FECHADA_TOTALMENTE",
        lojaAberta: open,
        mensagem: open
          ? "Estamos recebendo pedidos normalmente."
          : "A loja está fechada no momento.",
        mensagemFechamento: open
          ? "Estamos recebendo pedidos normalmente."
          : "A loja está fechada no momento.",
      }),
      method: "PUT",
    })
  },

  subscribeOrders(
    onData: (orders: Order[]) => void,
    onError: (error: unknown) => void
  ) {
    let timeoutId: number
    const controller = new AbortController()

    const poll = async () => {
      try {
        const orders = await this.listOrders({ signal: controller.signal })
        onData(orders)
        timeoutId = window.setTimeout(poll, realtimePollInterval)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        onError(error)
        timeoutId = window.setTimeout(poll, Math.max(1600, realtimePollInterval * 2))
      }
    }

    poll()

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  },
}
