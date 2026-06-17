import { Filter } from "lucide-react"

type FilterItem = {
  count: number
  label: string
  value: string
}

type Props = {
  activeFilter: string
  filters: FilterItem[]
  hideFinished: boolean
  onClear: () => void
  onFilterChange: (value: string, label: string) => void
  setHideFinished: (hideFinished: boolean) => void
}

export function OrderFilters({
  activeFilter,
  filters,
  hideFinished,
  onClear,
  onFilterChange,
  setHideFinished,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Fila</p>
          <h2 className="text-lg font-black text-white">Entrada</h2>
        </div>
        <Filter className="text-zinc-400" size={18} />
      </div>

      <div className="mt-3 space-y-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => onFilterChange(filter.value, filter.label)}
            className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-xs font-black ${
              activeFilter === filter.value
                ? filter.value === "entrega"
                  ? "bg-orange-400 text-black"
                  : "bg-white text-black"
                : "border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10"
            }`}
          >
            <span>{filter.label}</span>
            <span>{filter.count}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/[0.18] p-3 text-xs font-bold text-zinc-300">
        <input
          type="checkbox"
          checked={hideFinished}
          onChange={(event) => setHideFinished(event.target.checked)}
          className="h-4 w-4 accent-orange-400"
        />
        Ocultar concluídos e cancelados
      </label>

      <button
        className="mt-auto hidden h-10 rounded-lg bg-[#090b18] px-4 text-xs font-black uppercase text-white transition hover:bg-black xl:block"
        type="button"
        onClick={onClear}
      >
        Limpar filtros
      </button>
    </aside>
  )
}
