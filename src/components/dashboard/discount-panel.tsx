import { ReceiptText, Save, X } from "lucide-react"

import type { Order } from "../../types/order"

type DiscountMode = "valor" | "percentual"

type Props = {
  discountMode: DiscountMode
  discountOrder?: Order
  discountReason: string
  discountValue: number
  onApply: () => void
  onClose: () => void
  setDiscountMode: (mode: DiscountMode) => void
  setDiscountReason: (reason: string) => void
  setDiscountValue: (value: number) => void
}

export function DiscountPanel({
  discountMode,
  discountOrder,
  discountReason,
  discountValue,
  onApply,
  onClose,
  setDiscountMode,
  setDiscountReason,
  setDiscountValue,
}: Props) {
  if (!discountOrder) return null

  return (
    <div className="mt-3 shrink-0 rounded-lg border border-orange-300/25 bg-[rgba(36,22,11,0.96)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
            <ReceiptText size={15} />
            Bilhete de desconto
          </p>
          <h3 className="mt-1 text-lg font-black text-white">Pedido #{discountOrder.id} - {discountOrder.customer}</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-[130px_120px_minmax(0,1fr)_auto_auto]">
          <select
            value={discountMode}
            onChange={(event) => setDiscountMode(event.target.value as DiscountMode)}
            className="h-10 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none"
          >
            <option value="valor">Valor fixo</option>
            <option value="percentual">Percentual</option>
          </select>
          <input
            type="number"
            min={0}
            value={discountValue === 0 ? "" : discountValue}
            onChange={(event) => setDiscountValue(Number(event.target.value))}
            placeholder={discountMode === "valor" ? "5.00" : "10"}
            className="h-10 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <input
            value={discountReason}
            onChange={(event) => setDiscountReason(event.target.value)}
            placeholder="Motivo do desconto"
            className="h-10 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={onApply}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
          >
            <Save size={14} />
            Aplicar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
          >
            <X size={14} />
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
