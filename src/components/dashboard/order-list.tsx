import { PackageCheck, Search } from "lucide-react"

import { OrderCard } from "../order-card"
import type { Order } from "../../types/order"

type Props = {
  activeSelectedOrderId?: number
  activeWindowHours: number
  connectionStatus: "not-configured" | "offline" | "online"
  highlightedOrderIds: Set<number>
  isSyncing: boolean
  onSelectOrder: (order: Order) => void
  orders: Order[]
  search: string
  setSearch: (search: string) => void
}

export function OrderList({
  activeSelectedOrderId,
  activeWindowHours,
  connectionStatus,
  highlightedOrderIds,
  isSyncing,
  onSelectOrder,
  orders,
  search,
  setSearch,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Pedidos ativos</p>
          <h2 className="text-xl font-black text-white">{orders.length} na tela</h2>
          <p className="mt-1 text-xs font-bold text-zinc-500">Janela de {activeWindowHours} horas</p>
        </div>
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400 md:w-80">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
            placeholder="Buscar por cliente ou número"
          />
        </label>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            isNew={highlightedOrderIds.has(order.backendId ?? order.id)}
            isSelected={activeSelectedOrderId === order.id}
            order={order}
            onSelect={() => onSelectOrder(order)}
          />
        ))}

        {orders.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/[0.12] bg-black/[0.16] p-8 text-center">
            <PackageCheck className="mx-auto text-zinc-500" size={38} />
            <h3 className="mt-3 text-lg font-black text-white">
              {isSyncing ? "Carregando pedidos" : "Nenhum pedido encontrado"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {isSyncing
                ? "Buscando atualizações sem travar a fila local."
                : connectionStatus === "offline"
                ? "O painel fica pronto com o cache local e atualiza quando o sinal voltar."
                : "Quando entrar um pedido novo, ele aparece aqui em ordem de horário."}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
