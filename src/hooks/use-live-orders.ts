import { useEffect, useState } from "react"

import { ordersApi, hasOrdersBackend } from "../services/orders-api"
import type { Order } from "../types/order"

type ConnectionStatus = "not-configured" | "online" | "offline"

export function useLiveOrders() {
  const [orderList, setOrderList] = useState<Order[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    hasOrdersBackend ? "offline" : "not-configured"
  )
  const [lastSync, setLastSync] = useState<string>("")

  useEffect(() => {
    let isMounted = true

    async function loadOrders() {
      try {
        const orders = await ordersApi.listOrders()

        if (!isMounted) return

        setOrderList(orders)
        setLastSync(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
        setConnectionStatus(hasOrdersBackend ? "online" : "not-configured")
      } catch {
        if (isMounted) setConnectionStatus("offline")
      }
    }

    void loadOrders()

    const unsubscribe = ordersApi.subscribeOrders(
      (orders) => {
        setOrderList(orders)
        setLastSync(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
        setConnectionStatus("online")
      },
      () => setConnectionStatus(hasOrdersBackend ? "offline" : "not-configured")
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  async function updateOrder(id: number, changes: Partial<Order>) {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      return false
    }

    try {
      const updatedOrder = await ordersApi.updateOrder(id, changes)

      if (!updatedOrder) return false

      setOrderList((currentOrders) =>
        currentOrders.map((order) => (order.id === id ? updatedOrder : order))
      )
      return true
    } catch {
      setConnectionStatus("offline")
      return false
    }
  }

  async function updateStoreStatus(open: boolean) {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      return false
    }

    try {
      await ordersApi.updateStoreStatus(open)
      setConnectionStatus("online")
      return true
    } catch {
      setConnectionStatus("offline")
      return false
    }
  }

  return {
    connectionStatus,
    lastSync,
    orderList,
    updateOrder,
    updateStoreStatus,
  }
}
