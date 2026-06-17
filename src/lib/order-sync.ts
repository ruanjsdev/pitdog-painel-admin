import type { Order } from "../types/order"

export const ordersCacheKey = "pitsdog:admin:orders-cache:v1"
export const legacyOrdersCacheKey = "pitsdog:admin:orders:v1"
export const pendingActionsKey = "pitsdog:admin:pending-actions:v1"
export const activeOrdersWindowHours = 16
export const orderHistoryRetentionDays = 7

const hourInMs = 60 * 60 * 1000
const dayInMs = 24 * hourInMs

export type PendingOrderAction = {
  attempts: number
  changes: Partial<Order>
  createdAt: number
  id: string
  lastError?: string
  message: string
  orderId: number
}

export function getOrderKey(order: Pick<Order, "backendId" | "id">) {
  return String(order.backendId ?? order.id)
}

function getStartOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function getOrderTimestamp(order: Pick<Order, "createdAt" | "createdAtTimestamp">) {
  if (order.createdAtTimestamp && Number.isFinite(order.createdAtTimestamp)) {
    return order.createdAtTimestamp
  }

  if (!order.createdAt) return 0

  const parsedDate = new Date(order.createdAt).getTime()

  return Number.isNaN(parsedDate) ? 0 : parsedDate
}

export function sortOrdersByTime(orders: Order[]) {
  return [...orders].sort((first, second) => (
    getOrderTimestamp(second) - getOrderTimestamp(first) ||
    (second.backendId ?? second.id) - (first.backendId ?? first.id)
  ))
}

export function getOrderHistoryCutoff(now = new Date()) {
  return getStartOfLocalDay(now) - ((orderHistoryRetentionDays - 1) * dayInMs)
}

export function pruneExpiredOrderHistory(orders: Order[], now = new Date()) {
  const cutoff = getOrderHistoryCutoff(now)

  return sortOrdersByTime(orders.filter((order) => {
    const timestamp = getOrderTimestamp(order)

    return timestamp === 0 || timestamp >= cutoff
  }))
}

export function getActivePanelOrders(orders: Order[], now = Date.now()) {
  const cutoff = now - (activeOrdersWindowHours * hourInMs)

  return sortOrdersByTime(orders.filter((order) => {
    const timestamp = getOrderTimestamp(order)

    return timestamp === 0 || timestamp >= cutoff
  }))
}

export function getOrdersSignature(orders: Order[]) {
  return JSON.stringify(sortOrdersByTime(orders))
}

export function mergeOrders(existingOrders: Order[], incomingOrders: Order[]) {
  const ordersByKey = new Map<string, Order>()

  existingOrders.forEach((order) => {
    ordersByKey.set(getOrderKey(order), order)
  })

  incomingOrders.forEach((order) => {
    const key = getOrderKey(order)
    const currentOrder = ordersByKey.get(key)
    const incomingItems = Array.isArray(order.items) ? order.items : []

    ordersByKey.set(key, currentOrder
      ? {
          ...currentOrder,
          ...order,
          items: incomingItems.length > 0 ? incomingItems : currentOrder.items,
        }
      : order
    )
  })

  return pruneExpiredOrderHistory([...ordersByKey.values()])
}

export function readOrdersCache() {
  try {
    const cachedOrders =
      window.localStorage.getItem(ordersCacheKey) ??
      window.localStorage.getItem(legacyOrdersCacheKey)

    if (!cachedOrders) return []

    return pruneExpiredOrderHistory(JSON.parse(cachedOrders) as Order[])
  } catch {
    return []
  }
}

export function writeOrdersCache(orders: Order[]) {
  try {
    window.localStorage.setItem(ordersCacheKey, JSON.stringify(pruneExpiredOrderHistory(orders)))
  } catch {
    // Cache is a resilience layer for the admin; the API remains the source of truth.
  }
}

export function readPendingActions() {
  try {
    const pendingActions = window.localStorage.getItem(pendingActionsKey)

    if (!pendingActions) return []

    return JSON.parse(pendingActions) as PendingOrderAction[]
  } catch {
    return []
  }
}

export function writePendingActions(actions: PendingOrderAction[]) {
  try {
    window.localStorage.setItem(pendingActionsKey, JSON.stringify(actions))
  } catch {
    // Pending actions are best effort while the backend is unavailable.
  }
}

export function createPendingOrderAction(
  orderId: number,
  changes: Partial<Order>,
  message: string,
  lastError?: string
): PendingOrderAction {
  return {
    attempts: 0,
    changes,
    createdAt: Date.now(),
    id: `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lastError,
    message,
    orderId,
  }
}
