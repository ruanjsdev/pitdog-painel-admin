import type { Order } from "../types/order"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "")
const streamUrl = import.meta.env.VITE_ORDERS_STREAM_URL

export const hasOrdersBackend = Boolean(apiBaseUrl)

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("Backend URL is not configured.")
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const ordersApi = {
  async listOrders() {
    if (!apiBaseUrl) return []

    return request<Order[]>("/orders")
  },

  async updateOrder(id: number, changes: Partial<Order>) {
    if (!apiBaseUrl) return null

    return request<Order>(`/orders/${id}`, {
      body: JSON.stringify(changes),
      method: "PATCH",
    })
  },

  async updateStoreStatus(open: boolean) {
    if (!apiBaseUrl) return null

    return request<{ open: boolean }>("/store/status", {
      body: JSON.stringify({ open }),
      method: "PATCH",
    })
  },

  subscribeOrders(onOrders: (orders: Order[]) => void, onError: () => void) {
    if (streamUrl) {
      const events = new EventSource(streamUrl)

      events.addEventListener("orders", (event) => {
        onOrders(JSON.parse(event.data) as Order[])
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
    }, 5000)

    return () => window.clearInterval(interval)
  },
}
