type Props = {
  isSelected: boolean
  onSelect: () => void
  order: {
    id: number
    customer: string
    delivery: string
    time: string
    total: number
    status: string
  }
  isNew?: boolean
}

const statusStyles: Record<string, string> = {
  novo: "border-orange-300/50 bg-orange-400/15 text-orange-100",
  aprovado: "border-cyan-300/50 bg-cyan-400/15 text-cyan-100",
  preparando: "border-sky-300/50 bg-sky-400/15 text-sky-100",
  pronto: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
  saiu: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
  cancelado: "border-red-300/50 bg-red-400/15 text-red-100",
  concluido: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
  finalizado: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100",
}

const cardStyles: Record<string, string> = {
  novo: "border-orange-300/55 bg-orange-400/[0.11] shadow-[0_18px_42px_rgba(251,146,60,0.12)] hover:border-orange-300/80",
  aprovado: "border-cyan-300/55 bg-cyan-400/[0.10] shadow-[0_18px_42px_rgba(34,211,238,0.10)] hover:border-cyan-300/80",
  preparando: "border-sky-300/55 bg-sky-400/[0.10] shadow-[0_18px_42px_rgba(56,189,248,0.10)] hover:border-sky-300/80",
  pronto: "border-emerald-300/55 bg-emerald-400/[0.10] shadow-[0_18px_42px_rgba(52,211,153,0.10)] hover:border-emerald-300/80",
  saiu: "border-emerald-300/55 bg-emerald-400/[0.10] shadow-[0_18px_42px_rgba(52,211,153,0.10)] hover:border-emerald-300/80",
  cancelado: "border-red-300/55 bg-red-400/[0.10] shadow-[0_18px_42px_rgba(248,113,113,0.10)] hover:border-red-300/80",
  concluido: "border-emerald-300/55 bg-emerald-400/[0.10] shadow-[0_18px_42px_rgba(52,211,153,0.10)] hover:border-emerald-300/80",
  finalizado: "border-emerald-300/55 bg-emerald-400/[0.10] shadow-[0_18px_42px_rgba(52,211,153,0.10)] hover:border-emerald-300/80",
}

const selectedCardStyles: Record<string, string> = {
  novo: "border-orange-100 bg-orange-400/[0.20] shadow-[0_0_0_2px_rgba(253,186,116,0.32),0_22px_48px_rgba(251,146,60,0.20)]",
  aprovado: "border-cyan-100 bg-cyan-400/[0.19] shadow-[0_0_0_2px_rgba(103,232,249,0.32),0_22px_48px_rgba(34,211,238,0.18)]",
  preparando: "border-sky-100 bg-sky-400/[0.19] shadow-[0_0_0_2px_rgba(125,211,252,0.32),0_22px_48px_rgba(56,189,248,0.18)]",
  pronto: "border-emerald-100 bg-emerald-400/[0.19] shadow-[0_0_0_2px_rgba(110,231,183,0.32),0_22px_48px_rgba(52,211,153,0.18)]",
  saiu: "border-emerald-100 bg-emerald-400/[0.19] shadow-[0_0_0_2px_rgba(110,231,183,0.32),0_22px_48px_rgba(52,211,153,0.18)]",
  cancelado: "border-red-100 bg-red-400/[0.19] shadow-[0_0_0_2px_rgba(252,165,165,0.32),0_22px_48px_rgba(248,113,113,0.18)]",
  concluido: "border-emerald-100 bg-emerald-400/[0.19] shadow-[0_0_0_2px_rgba(110,231,183,0.32),0_22px_48px_rgba(52,211,153,0.18)]",
  finalizado: "border-emerald-100 bg-emerald-400/[0.19] shadow-[0_0_0_2px_rgba(110,231,183,0.32),0_22px_48px_rgba(52,211,153,0.18)]",
}

const accentStyles: Record<string, string> = {
  novo: "bg-orange-300",
  aprovado: "bg-cyan-300",
  preparando: "bg-sky-300",
  pronto: "bg-emerald-300",
  saiu: "bg-emerald-300",
  cancelado: "bg-red-300",
  concluido: "bg-emerald-300",
  finalizado: "bg-emerald-300",
}

const metaStyles: Record<string, string> = {
  novo: "text-orange-100/80",
  aprovado: "text-cyan-100/80",
  preparando: "text-sky-100/80",
  pronto: "text-emerald-100/80",
  saiu: "text-emerald-100/80",
  cancelado: "text-red-100/80",
  concluido: "text-emerald-100/80",
  finalizado: "text-emerald-100/80",
}

const deliveryStyles: Record<string, string> = {
  Delivery: "border-orange-300/45 bg-orange-400/15 text-orange-100",
  Mesa: "border-cyan-300/45 bg-cyan-400/15 text-cyan-100",
  Retirada: "border-white/20 bg-white/10 text-white",
}

const statusLabels: Record<string, string> = {
  novo: "Aguardando aprovação",
  aprovado: "Aprovado",
  preparando: "Em preparação",
  pronto: "Pronto",
  saiu: "Saiu para entrega",
  cancelado: "Cancelado",
  concluido: "Concluído",
  finalizado: "Finalizado",
}

export function OrderCard({ isNew = false, isSelected, onSelect, order }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`relative w-full overflow-hidden rounded-lg border p-4 pl-5 text-left transition hover:-translate-y-0.5 ${
        isSelected
          ? selectedCardStyles[order.status] ?? selectedCardStyles.novo
          : cardStyles[order.status] ?? cardStyles.novo
      } ${isNew ? "animate-[new-order-pulse_1.8s_ease-out_infinite]" : ""}`}
    >
      <span className={`absolute inset-y-0 left-0 ${isSelected ? "w-2.5" : "w-1.5"} ${accentStyles[order.status] ?? accentStyles.novo}`} />
      {isSelected && (
        <span className={`absolute right-3 top-3 h-3 w-3 rounded-full ring-4 ring-white/15 ${accentStyles[order.status] ?? accentStyles.novo}`} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-orange-200">
          Pedido #{order.id}
        </span>
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="rounded-full border border-orange-200/60 bg-orange-300 px-2 py-0.5 text-[10px] font-black uppercase text-black">
              Novo
            </span>
          )}
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusStyles[order.status] ?? statusStyles.novo}`}>
            {statusLabels[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <strong className="mt-3 block truncate text-xl font-black text-white">
        {order.customer}
      </strong>

      <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold ${metaStyles[order.status] ?? metaStyles.novo}`}>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${deliveryStyles[order.delivery] ?? deliveryStyles.Retirada}`}>
          {order.delivery}
        </span>
        <span>R$ {order.total}</span>
      </div>
    </div>
  )
}
