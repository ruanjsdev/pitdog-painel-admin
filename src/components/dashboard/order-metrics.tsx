import type { LucideIcon } from "lucide-react"
import { CheckCircle2, DollarSign, Megaphone } from "lucide-react"

type Metric = {
  detail: string
  icon: LucideIcon
  label: string
  status: string
  value: string
}

type MenuSignal = {
  className: string
  dotClassName: string
  label: string
}

type Props = {
  activeStatusFilter: string
  cashOrdersCount: number
  menuSignal: MenuSignal
  metrics: Metric[]
  onMetricClick: (status: string, label: string) => void
  syncClock: string
}

export function OrderMetrics({
  activeStatusFilter,
  cashOrdersCount,
  menuSignal,
  metrics,
  onMetricClick,
  syncClock,
}: Props) {
  return (
    <section className="dashboard-order-metrics mt-3 grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {metrics.map((metric) => {
            const Icon = metric.icon

            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => onMetricClick(metric.status, metric.label)}
                className={`rounded-lg border p-2.5 text-left transition hover:bg-white/[0.06] ${
                  activeStatusFilter === metric.status && metric.status !== "todos"
                    ? "border-orange-300/60 bg-orange-400/[0.12]"
                    : "border-white/10 bg-black/[0.18]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] font-black uppercase leading-3 text-zinc-500">{metric.label}</span>
                  <Icon className="shrink-0 text-zinc-400" size={14} />
                </div>
                <strong className="mt-1.5 block text-xl font-black text-white">{metric.value}</strong>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">{metric.detail}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3 sm:grid-cols-4 lg:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.12] px-3 py-2 text-left text-xs font-black text-cyan-100">
          <Megaphone size={15} />
          Operação
        </div>
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-black ${menuSignal.className}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${menuSignal.dotClassName}`} />
          {menuSignal.label}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white">
          <CheckCircle2 size={15} />
          {`Sincronizado ${syncClock}`}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white">
          <DollarSign size={15} />
          {cashOrdersCount} pedidos no caixa
        </div>
      </div>
    </section>
  )
}
