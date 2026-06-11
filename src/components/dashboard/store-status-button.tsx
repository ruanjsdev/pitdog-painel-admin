import { useState } from "react"

type Props = {
  backendReady: boolean
  onNotice: (message: string) => void
  onToggleStore: (open: boolean) => Promise<boolean>
  storeOpen: boolean
  setStoreOpen: (open: boolean) => void
}

export function StoreStatusButton({
  backendReady,
  onNotice,
  onToggleStore,
  setStoreOpen,
  storeOpen,
}: Props) {
  const [saving, setSaving] = useState(false)

  return (
    <button
      className={`h-9 rounded-lg px-3 text-xs font-black transition ${
        storeOpen ? "bg-red-500 text-white hover:bg-red-400" : "bg-emerald-400 text-black hover:bg-emerald-300"
      }`}
      type="button"
      onClick={async () => {
        if (saving) return

        if (!backendReady) {
          onNotice("Conecte o backend para alterar o status real da loja.")
          return
        }

        const nextStoreOpen = !storeOpen
        setSaving(true)

        const updated = await onToggleStore(nextStoreOpen)

        if (updated) {
          setStoreOpen(nextStoreOpen)
          onNotice(nextStoreOpen ? "Loja aberta." : "Loja fechada.")
        } else {
          onNotice("Não foi possível alterar a loja. Aguardando backend.")
        }

        setSaving(false)
      }}
      disabled={saving}
    >
      {saving ? "Salvando..." : storeOpen ? "Fechar loja" : "Abrir loja"}
    </button>
  )
}
