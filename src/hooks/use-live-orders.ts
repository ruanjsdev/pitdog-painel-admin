import { useCallback, useEffect, useRef, useState } from "react"

import {
  createPendingOrderAction,
  getOrderKey,
  getOrdersSignature,
  mergeOrders,
  pruneExpiredOrderHistory,
  readOrdersCache,
  readPendingActions,
  writeOrdersCache,
  writePendingActions,
  type PendingOrderAction,
} from "../lib/order-sync"
import { hasOrdersBackend, ordersApi } from "../services/orders-api"
import type { Order } from "../types/order"

type ConnectionStatus = "not-configured" | "online" | "offline"
type SaveStatus = "idle" | "saving" | "saved" | "pending" | "error"

function mergeOrderPreservingItems(currentOrder: Order, updatedOrder: Order) {
  const updatedItems = Array.isArray(updatedOrder.items) ? updatedOrder.items : []

  return {
    ...currentOrder,
    ...updatedOrder,
    items: updatedItems.length > 0 ? updatedItems : currentOrder.items,
  }
}

export function useLiveOrders() {
  const [orderList, setOrderList] = useState<Order[]>(() => readOrdersCache())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    hasOrdersBackend ? "offline" : "not-configured"
  )
  const [lastSync, setLastSync] = useState<string>("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [pendingActions, setPendingActions] = useState<PendingOrderAction[]>(() => readPendingActions())

  const isMountedRef = useRef(true)
  const hasLoadedInitialRef = useRef(false)
  const isLoadingOrdersRef = useRef(false)
  const isRetryingPendingRef = useRef(false)
  const realtimeFailureCountRef = useRef(0)
  const optimisticChangesRef = useRef(new Map<string, { changes: Partial<Order>; expiresAt: number }>())
  const pendingActionsRef = useRef<PendingOrderAction[]>(pendingActions)
  const ordersSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    pendingActionsRef.current = pendingActions
  }, [pendingActions])

  const persistOrders = useCallback((orders: Order[]) => {
    const sortedOrders = pruneExpiredOrderHistory(orders)
    const nextSignature = getOrdersSignature(sortedOrders)

    if (ordersSignatureRef.current === nextSignature) {
      return sortedOrders
    }

    ordersSignatureRef.current = nextSignature
    writeOrdersCache(sortedOrders)

    return sortedOrders
  }, [])

  const setAndCacheOrders = useCallback(
    (getNextOrders: (currentOrders: Order[]) => Order[]) => {
      setOrderList((currentOrders) => {
        if (ordersSignatureRef.current === null) {
          ordersSignatureRef.current = getOrdersSignature(currentOrders)
        }

        const nextOrders = persistOrders(getNextOrders(currentOrders))

        return ordersSignatureRef.current === getOrdersSignature(currentOrders) ? currentOrders : nextOrders
      })
    },
    [persistOrders]
  )

  const persistPendingActions = useCallback((actions: PendingOrderAction[]) => {
    writePendingActions(actions)
    pendingActionsRef.current = actions
    setPendingActions(actions)
  }, [])

  const rememberOptimisticChanges = useCallback((id: number, changes: Partial<Order>, ttlMs = 4500) => {
    optimisticChangesRef.current.set(String(id), {
      changes,
      expiresAt: Date.now() + ttlMs,
    })
  }, [])

  const clearOptimisticChanges = useCallback((id: number) => {
    optimisticChangesRef.current.delete(String(id))
  }, [])

  const applyOptimisticChanges = useCallback((orders: Order[]) => {
    const now = Date.now()

    optimisticChangesRef.current.forEach((entry, key) => {
      if (entry.expiresAt > now) return

      optimisticChangesRef.current.delete(key)
    })

    if (optimisticChangesRef.current.size === 0) return orders

    return orders.map((order) => {
      const entry =
        optimisticChangesRef.current.get(getOrderKey(order)) ??
        optimisticChangesRef.current.get(String(order.id)) ??
        (order.backendId ? optimisticChangesRef.current.get(String(order.backendId)) : undefined)

      return entry ? { ...order, ...entry.changes } : order
    })
  }, [])

  const loadOrders = useCallback(
    async (source: "initial" | "manual" | "online" | "after-save" = "manual") => {
      if (!hasOrdersBackend) {
        setConnectionStatus("not-configured")
        setIsSyncing(false)
        return false
      }

      if (isLoadingOrdersRef.current) {
        console.log("[orders-sync] ignored: already loading orders")
        return false
      }

      isLoadingOrdersRef.current = true
      setIsSyncing(true)

      console.log(`[orders-sync] load orders: ${source}`)

      try {
        const apiOrders = await ordersApi.listOrders()

        if (!isMountedRef.current) return false

        setAndCacheOrders((currentOrders) => applyOptimisticChanges(mergeOrders(currentOrders, apiOrders)))

        setLastSync(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        )

        setConnectionStatus("online")

        if (pendingActionsRef.current.length === 0) {
          setSaveStatus("saved")
        }

        return true
      } catch (error) {
        console.error("[orders-sync] load failed", error)

        if (isMountedRef.current) {
          setConnectionStatus("offline")
          setSaveStatus(pendingActionsRef.current.length > 0 ? "pending" : "error")
        }

        return false
      } finally {
        isLoadingOrdersRef.current = false

        if (isMountedRef.current) {
          setIsSyncing(false)
        }
      }
    },
    [setAndCacheOrders]
  )

  const queuePendingAction = useCallback(
    (orderId: number, changes: Partial<Order>, message: string, error?: unknown) => {
      const lastError = error instanceof Error ? error.message : undefined
      const action = createPendingOrderAction(orderId, changes, message, lastError)

      setPendingActions((currentActions) => {
        const nextActions = [...currentActions, action]

        writePendingActions(nextActions)
        pendingActionsRef.current = nextActions

        return nextActions
      })

      setSaveStatus("pending")
    },
    []
  )

  const retryPendingActions = useCallback(async () => {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      return false
    }

    const actionsToRetry = pendingActionsRef.current

    if (actionsToRetry.length === 0) {
      setSaveStatus("saved")
      return true
    }

    if (isRetryingPendingRef.current) {
      console.log("[orders-sync] ignored: already retrying pending actions")
      return false
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setConnectionStatus("offline")
      setSaveStatus("pending")
      return false
    }

    isRetryingPendingRef.current = true
    setSaveStatus("saving")

    console.log("[orders-sync] retry pending actions")

    const remainingActions: PendingOrderAction[] = []
    let backendAnswered = false

    try {
      for (const action of actionsToRetry) {
        try {
          const updatedOrder = await ordersApi.updateOrder(action.orderId, action.changes)

          backendAnswered = true

          if (!updatedOrder) {
            remainingActions.push({
              ...action,
              attempts: action.attempts + 1,
              lastError: "API respondeu, mas não confirmou a alteração.",
            })

            continue
          }

          rememberOptimisticChanges(action.orderId, updatedOrder, 1800)
          setAndCacheOrders((currentOrders) =>
            applyOptimisticChanges(currentOrders.map((order) =>
              order.id === action.orderId || order.backendId === action.orderId
                ? mergeOrderPreservingItems(order, updatedOrder)
                : order
            ))
          )
        } catch (error) {
          remainingActions.push({
            ...action,
            attempts: action.attempts + 1,
            lastError: error instanceof Error ? error.message : action.lastError,
          })
        }
      }

      persistPendingActions(remainingActions)

      if (remainingActions.length === 0) {
        setConnectionStatus("online")
        setSaveStatus("saved")

        void loadOrders("after-save")
        return true
      }

      /*
        Importante:
        Se o backend respondeu pelo menos uma requisição, não marcamos como offline.
        Nesse caso, o backend está acessível, mas algumas pendências não foram aceitas.
      */
      setConnectionStatus(backendAnswered ? "online" : "offline")
      setSaveStatus("pending")

      return false
    } finally {
      isRetryingPendingRef.current = false
    }
  }, [loadOrders, persistPendingActions, setAndCacheOrders])

  useEffect(() => {
    isMountedRef.current = true

    if (!hasLoadedInitialRef.current) {
      hasLoadedInitialRef.current = true
      void loadOrders("initial")
    }

    const handleOnline = () => {
      console.log("[orders-sync] browser online")

      if (!hasOrdersBackend) {
        setConnectionStatus("not-configured")
        return
      }

      void loadOrders("online")

      if (pendingActionsRef.current.length > 0) {
        void retryPendingActions()
      }
    }

    const handleOffline = () => {
      console.log("[orders-sync] browser offline")
      setConnectionStatus("offline")
      setSaveStatus(pendingActionsRef.current.length > 0 ? "pending" : "idle")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const stopRealtimeConnection = hasOrdersBackend
      ? ordersApi.subscribeOrders(
          (apiOrders) => {
            if (!isMountedRef.current) return

            realtimeFailureCountRef.current = 0
            setAndCacheOrders((currentOrders) => applyOptimisticChanges(mergeOrders(currentOrders, apiOrders)))
            setLastSync(
              new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            )
            setConnectionStatus("online")

            if (pendingActionsRef.current.length === 0) {
              setSaveStatus("saved")
            }
          },
          () => {
            if (!isMountedRef.current) return

            realtimeFailureCountRef.current += 1
            console.warn(`[orders-sync] realtime sync failed (${realtimeFailureCountRef.current})`)

            if (realtimeFailureCountRef.current < 3) return

            setConnectionStatus("offline")
            setSaveStatus(pendingActionsRef.current.length > 0 ? "pending" : "error")
          }
        )
      : () => undefined

    return () => {
      isMountedRef.current = false
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      stopRealtimeConnection()
    }
  }, [loadOrders, retryPendingActions, setAndCacheOrders])

  async function updateOrder(id: number, changes: Partial<Order>, message = "Alteração pendente") {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      queuePendingAction(id, changes, message)
      return false
    }

    setSaveStatus("saving")
    rememberOptimisticChanges(id, changes)

    try {
      const updatedOrder = await ordersApi.updateOrder(id, changes)

      if (!updatedOrder) {
        /*
          Aqui não colocamos backend offline.
          A API pode ter respondido sem confirmar a alteração.
          Isso vira pendência, não queda do backend.
        */
        setConnectionStatus("online")
        queuePendingAction(id, changes, message)
        return false
      }

      rememberOptimisticChanges(id, updatedOrder, 1800)
      setAndCacheOrders((currentOrders) =>
        applyOptimisticChanges(currentOrders.map((order) =>
          order.id === id || order.backendId === id ? mergeOrderPreservingItems(order, updatedOrder) : order
        ))
      )

      setConnectionStatus("online")
      setSaveStatus("saved")

      return true
    } catch (error) {
      clearOptimisticChanges(id)
      setConnectionStatus("offline")
      queuePendingAction(id, changes, message, error)
      return false
    }
  }

  async function runOrderMutation(
    id: number,
    mutation: () => Promise<Order | null>,
    fallbackChanges: Partial<Order>,
    message = "Alteração pendente"
  ) {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      queuePendingAction(id, fallbackChanges, message)
      return false
    }

    setSaveStatus("saving")
    rememberOptimisticChanges(id, fallbackChanges)

    try {
      const updatedOrder = await mutation()

      if (!updatedOrder) {
        setConnectionStatus("online")
        queuePendingAction(id, fallbackChanges, message)
        return false
      }

      rememberOptimisticChanges(id, updatedOrder, 1800)
      setAndCacheOrders((currentOrders) =>
        applyOptimisticChanges(currentOrders.map((order) =>
          order.id === id || order.backendId === id ? mergeOrderPreservingItems(order, updatedOrder) : order
        ))
      )

      setConnectionStatus("online")
      setSaveStatus("saved")

      return true
    } catch (error) {
      clearOptimisticChanges(id)
      setConnectionStatus("offline")
      queuePendingAction(id, fallbackChanges, message, error)
      return false
    }
  }

  async function restoreOrder(order: Order) {
    const id = order.backendId ?? order.id

    return runOrderMutation(
      id,
      () => ordersApi.restoreOrder(id),
      {
        changeFor: undefined,
        paymentChangeFor: undefined,
        paymentChangeValue: undefined,
        paymentConfirmed: false,
        paymentStatus: "PENDENTE",
        status: "novo",
      },
      `Pedido #${order.id} restaurado.`
    )
  }

  function applyOrderChanges(id: number, changes: Partial<Order>) {
    rememberOptimisticChanges(id, changes)
    setAndCacheOrders((currentOrders) =>
      applyOptimisticChanges(currentOrders.map((order) =>
        order.id === id || order.backendId === id ? { ...order, ...changes } : order
      ))
    )
  }

  async function updateStoreStatus(open: boolean) {
    if (!hasOrdersBackend) {
      setConnectionStatus("not-configured")
      return false
    }

    setSaveStatus("saving")

    try {
      await ordersApi.updateStoreStatus(open)

      setConnectionStatus("online")
      setSaveStatus("saved")

      return true
    } catch {
      setConnectionStatus("offline")
      setSaveStatus("error")

      return false
    }
  }

  return {
    applyOrderChanges,
    connectionStatus,
    isSyncing,
    lastSync,
    loadOrders,
    orderList,
    pendingActions,
    pendingCount: pendingActions.length,
    retryPendingActions,
    restoreOrder,
    saveStatus,
    updateOrder,
    updateStoreStatus,
  }
}

export function handleRealtimeOrderEvent(currentOrders: Order[], incomingOrder: Order) {
  return mergeOrders(currentOrders, [incomingOrder])
}
