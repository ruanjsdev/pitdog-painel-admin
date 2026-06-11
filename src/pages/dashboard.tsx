import { useMemo, useState } from "react"
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Edit3,
  ExternalLink,
  Filter,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  PackageCheck,
  Plus,
  Phone,
  Save,
  Search,
  Settings,
  Store,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react"

import { OrderCard } from "../components/order-card"
import { useLiveOrders } from "../hooks/use-live-orders"
import { useMenuAdmin } from "../hooks/use-menu-admin"
import { MainLayout } from "../layouts/main-layout"
import type { MenuCategory, MenuCategoryDraft } from "../types/menu"
import type { DeliveryType, Order } from "../types/order"

type DashboardProps = {
  onLogout: () => void
}

type OrderFilter = "todos" | "mesa" | "retirada" | "entrega"

const statusLabels: Record<string, string> = {
  novo: "Aguardando aprovacao",
  preparando: "Em preparacao",
  saiu: "Saiu para entrega",
  cancelado: "Cancelado",
  concluido: "Concluido",
}

const cancelReasons = [
  "Pedido duplicado",
  "Cancelado pelo cliente",
  "Item indisponivel",
  "Endereco fora da area",
  "Pagamento nao confirmado",
  "Pedido feito por engano",
]

const paymentOptions = ["Pix", "Cartão", "Dinheiro"]
const deliveryOptions: DeliveryType[] = ["Delivery", "Mesa", "Retirada"]

const emptyCategoryDraft: MenuCategoryDraft = {
  descricao: "",
  imagem: "",
  nome: "",
  ordem: 1,
  ativo: true,
}

const deliveryStyles: Record<string, string> = {
  Delivery: "border-orange-300/40 bg-orange-400/12 text-orange-100",
  Mesa: "border-cyan-300/40 bg-cyan-400/12 text-cyan-100",
  Retirada: "border-white/15 bg-white/8 text-white",
}

const deliveryIcons: Record<string, typeof Truck> = {
  Delivery: Truck,
  Mesa: Store,
  Retirada: PackageCheck,
}

function matchesFilter(order: Order, filter: OrderFilter) {
  if (filter === "todos") return true
  if (filter === "entrega") return order.delivery === "Delivery"
  if (filter === "retirada") return order.delivery === "Retirada"
  return order.delivery === "Mesa"
}

export function Dashboard({ onLogout }: DashboardProps) {
  const {
    connectionStatus,
    lastSync,
    orderList,
    updateOrder,
    updateStoreStatus,
  } = useLiveOrders()
  const menuAdmin = useMenuAdmin()
  const [selectedOrderId, setSelectedOrderId] = useState<number>()
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("todos")
  const [search, setSearch] = useState("")
  const [hideFinished, setHideFinished] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [storeOpen, setStoreOpen] = useState(true)
  const [notice, setNotice] = useState("Painel de gestão ")
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelReason, setCancelReason] = useState(cancelReasons[0])
  const [categoryDraft, setCategoryDraft] = useState<MenuCategoryDraft>(emptyCategoryDraft)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [menuPanelOpen, setMenuPanelOpen] = useState(false)
  const [draft, setDraft] = useState<Pick<Order, "address" | "customer" | "delivery" | "notes" | "payment" | "phone" | "total"> | null>(null)

  const activeSelectedOrderId = selectedOrderId ?? orderList[0]?.id
  const selectedOrder = orderList.find((order) => order.id === activeSelectedOrderId)

  const counts = useMemo(() => {
    const countByDelivery = (delivery: string) =>
      orderList.filter((order) => order.delivery === delivery && order.status !== "cancelado").length

    return {
      all: orderList.length,
      mesa: countByDelivery("Mesa"),
      retirada: countByDelivery("Retirada"),
      entrega: countByDelivery("Delivery"),
      novo: orderList.filter((order) => order.status === "novo").length,
      preparando: orderList.filter((order) => order.status === "preparando").length,
      saiu: orderList.filter((order) => order.status === "saiu").length,
      cancelado: orderList.filter((order) => order.status === "cancelado").length,
      concluido: orderList.filter((order) => order.status === "concluido").length,
    }
  }, [orderList])

  const metrics = [
    {
      label: "Aguardando aprovacao",
      value: String(counts.novo),
      detail: "novos pedidos",
      icon: Clock3,
    },
    {
      label: "Atualizado",
      value: "0",
      detail: "sem pendencias",
      icon: CheckCircle2,
    },
    {
      label: "Em preparacao",
      value: String(counts.preparando),
      detail: "na cozinha",
      icon: PackageCheck,
    },
    {
      label: "Saiu para entrega",
      value: String(counts.saiu),
      detail: "com entregador",
      icon: Truck,
    },
    {
      label: "Pronto retirada",
      value: String(counts.retirada),
      detail: "aguardando cliente",
      icon: Store,
    },
    {
      label: "Agendado",
      value: "1",
      detail: "para hoje",
      icon: CalendarDays,
    },
    {
      label: "Cancelado",
      value: String(counts.cancelado),
      detail: "pedidos cancelados",
      icon: XCircle,
    },
    {
      label: "Concluido",
      value: String(counts.concluido),
      detail: "pedidos finalizados",
      icon: CheckCircle2,
    },
  ]

  const visibleOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return orderList.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        order.customer.toLowerCase().includes(normalizedSearch) ||
        String(order.id).includes(normalizedSearch)

      const matchesFinished = !hideFinished || (order.status !== "concluido" && order.status !== "cancelado")

      return matchesFilter(order, activeFilter) && matchesSearch && matchesFinished
    })
  }, [activeFilter, hideFinished, orderList, search])

  function selectOrder(order: Order) {
    setSelectedOrderId(order.id)
    setIsEditing(false)
    setIsCanceling(false)
    setDraft(null)
    setNotice(`Pedido #${order.id} selecionado.`)
  }

  async function updateSelectedOrder(changes: Partial<Order>, message: string) {
    if (!selectedOrder) return false

    const updated = await updateOrder(selectedOrder.id, changes)

    setNotice(updated ? message : "Nao foi possivel salvar. Aguardando backend.")
    return updated
  }

  function startEdit() {
    if (!selectedOrder) return

    setDraft({
      address: selectedOrder.address,
      customer: selectedOrder.customer,
      delivery: selectedOrder.delivery,
      notes: selectedOrder.notes ?? "",
      payment: selectedOrder.payment,
      phone: selectedOrder.phone,
      total: selectedOrder.total,
    })
    setIsEditing(true)
    setIsCanceling(false)
    setNotice(`Editando pedido #${selectedOrder.id}.`)
  }

  async function saveEdit() {
    if (!draft || !selectedOrder) return

    const updated = await updateSelectedOrder(draft, `Pedido #${selectedOrder.id} atualizado.`)

    if (updated) {
      setIsEditing(false)
      setDraft(null)
    }
  }

  async function confirmCancel() {
    if (!selectedOrder) return

    const updated = await updateSelectedOrder(
      { cancelReason, status: "cancelado" },
      `Pedido #${selectedOrder.id} cancelado. Motivo: ${cancelReason}.`
    )

    if (updated) setIsCanceling(false)
  }

  async function saveCategory() {
    if (!menuAdmin.isConnected) {
      setNotice("Conecte o backend do cardapio para salvar categorias reais.")
      return
    }

    if (editingCategoryId) {
      await menuAdmin.updateCategory(editingCategoryId, categoryDraft)
      setNotice(`${categoryDraft.nome} atualizado no cardapio.`)
    } else {
      await menuAdmin.createCategory(categoryDraft)
      setNotice(`${categoryDraft.nome} cadastrado no cardapio.`)
    }

    setCategoryDraft(emptyCategoryDraft)
    setEditingCategoryId(null)
  }

  function editCategory(category: MenuCategory) {
    setEditingCategoryId(category.id)
    setCategoryDraft({
      ativo: category.ativo,
      descricao: category.descricao,
      imagem: category.imagem ?? "",
      nome: category.nome,
      ordem: category.ordem,
    })
    setNotice(`Editando categoria ${category.nome}.`)
  }

  function cancelCategoryEdit() {
    setCategoryDraft(emptyCategoryDraft)
    setEditingCategoryId(null)
    setNotice("Edicao de categoria cancelada.")
  }

  async function toggleCategoryStatus(category: MenuCategory) {
    if (!menuAdmin.isConnected) {
      setNotice("Conecte o backend do cardapio para alterar categorias reais.")
      return
    }

    await menuAdmin.updateCategoryStatus(category.id, !category.ativo)
    setNotice(!category.ativo ? "Categoria ativada no cardapio." : "Categoria desativada no cardapio.")
  }

  async function removeCategory(category: MenuCategory) {
    if (!menuAdmin.isConnected) {
      setNotice("Conecte o backend do cardapio para deletar categorias reais.")
      return
    }

    await menuAdmin.deleteCategory(category.id)
    setNotice(`${category.nome} removida do cardapio.`)
  }

  const filters: Array<{ label: string; value: OrderFilter; count: number }> = [
    { label: "Todos os pedidos", value: "todos", count: counts.all },
    { label: "Mesa", value: "mesa", count: counts.mesa },
    { label: "Retirada", value: "retirada", count: counts.retirada },
    { label: "Entrega", value: "entrega", count: counts.entrega },
  ]
  const SelectedDeliveryIcon = selectedOrder ? deliveryIcons[selectedOrder.delivery] ?? PackageCheck : PackageCheck
  const connectionLabel = {
    "not-configured": "Aguardando backend",
    offline: "Backend offline",
    online: lastSync ? `Ao vivo ${lastSync}` : "Ao vivo",
  }[connectionStatus]
  const menuSignal = {
    "not-configured": {
      className: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
      dotClassName: "bg-cyan-300",
      label: "Aguardando backend",
    },
    offline: {
      className: "border-red-300/20 bg-red-400/10 text-red-200",
      dotClassName: "bg-red-300",
      label: "Sinal caiu",
    },
    online: {
      className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
      dotClassName: "bg-emerald-300",
      label: "Sinal ligado",
    },
  }[connectionStatus]
  const menuConnectionLabel = {
    "not-configured": "Cardapio sem backend",
    offline: "Cardapio offline",
    online: "Cardapio conectado",
  }[menuAdmin.status]
  const backendReady = connectionStatus === "online"

  return (
    <MainLayout>
      <div className={`flex h-full w-full flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-5 ${
        storeOpen ? "bg-white/[0.03]" : "bg-red-950/35"
      }`}>
        {!storeOpen && (
          <div className="mb-3 shrink-0 rounded-lg border border-red-300/35 bg-red-500/20 px-4 py-3 shadow-[0_18px_48px_rgba(239,68,68,0.18)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <strong className="text-sm font-black uppercase tracking-[0.16em] text-red-100">
                Loja fechada
              </strong>
              <span className="text-xs font-bold text-red-100/75">
                O cardapio deve bloquear novos pedidos enquanto este estado estiver fechado.
              </span>
            </div>
          </div>
        )}

        <header className={`shrink-0 rounded-lg border px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl ${
          storeOpen
            ? "border-white/10 bg-[rgba(18,11,7,0.92)]"
            : "border-red-300/30 bg-[rgba(75,14,14,0.92)]"
        }`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/LogoPitis.png"
                alt="Pits Dog"
                className="dashboard-logo shrink-0 drop-shadow-[0_0_18px_rgba(255,106,0,0.42)]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
                  Pits em acao
                </p>
                <h1 className="truncate text-2xl font-black text-white">Central de pedidos</h1>
                <p className={`mt-0.5 truncate text-xs ${storeOpen ? "text-zinc-500" : "text-red-100/70"}`}>{notice}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black ${
                connectionStatus === "online"
                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                  : connectionStatus === "offline"
                    ? "border-red-300/25 bg-red-400/10 text-red-100"
                    : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
              }`}>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  connectionStatus === "online"
                    ? "bg-emerald-300"
                    : connectionStatus === "offline"
                      ? "bg-red-300"
                      : "bg-cyan-300"
                }`} />
                {connectionLabel}
              </span>
              <button
                type="button"
                onClick={() => setNotice("Resumo dos pedidos selecionado.")}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
              >
                <LayoutDashboard size={15} />
                Resumo
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black transition hover:bg-cyan-300"
                type="button"
                onClick={() => {
                  setMenuPanelOpen((value) => !value)
                  setNotice("Integracoes do cardapio abertas.")
                }}
              >
                <Settings size={15} />
                Integracoes
              </button>
              <button
                className={`h-9 rounded-lg px-3 text-xs font-black transition ${
                  storeOpen ? "bg-red-500 text-white hover:bg-red-400" : "bg-emerald-400 text-black hover:bg-emerald-300"
                }`}
                type="button"
                onClick={async () => {
                  if (!backendReady) {
                    setNotice("Conecte o backend para alterar o status real da loja.")
                    return
                  }

                  const nextStoreOpen = !storeOpen

                  const updated = await updateStoreStatus(nextStoreOpen)

                  if (updated) {
                    setStoreOpen(nextStoreOpen)
                    setNotice(nextStoreOpen ? "Loja aberta." : "Loja fechada.")
                  } else {
                    setNotice("Nao foi possivel alterar a loja. Aguardando backend.")
                  }
                }}
              >
                {storeOpen ? "Fechar loja" : "Abrir loja"}
              </button>
              <a
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                href="https://pitsdog-cardapio-oficial.onrender.com"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Cardapio
              </a>
              <button
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                type="button"
                onClick={() => setNotice("Notificacoes conferidas.")}
                aria-label="Notificacoes"
              >
                <Bell size={16} />
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <section className="mt-3 grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {metrics.map((metric) => {
                const Icon = metric.icon

                return (
                  <article key={metric.label} className="rounded-lg border border-white/10 bg-black/[0.18] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[9px] font-black uppercase leading-3 text-zinc-500">{metric.label}</span>
                      <Icon className="shrink-0 text-zinc-400" size={14} />
                    </div>
                    <strong className="mt-1.5 block text-xl font-black text-white">{metric.value}</strong>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">{metric.detail}</p>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3 sm:grid-cols-4 lg:grid-cols-2">
            <button
              className="flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.12] px-3 py-2 text-left text-xs font-black text-cyan-100"
              type="button"
              onClick={() => {
                setMenuPanelOpen((value) => !value)
                setNotice("Gerenciamento do cardapio aberto.")
              }}
            >
              <Megaphone size={15} />
              Cardapio
            </button>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-black ${menuSignal.className}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${menuSignal.dotClassName}`} />
              {menuSignal.label}
            </div>
            <button
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white transition hover:bg-white/10"
              type="button"
              onClick={() => setNotice("Contagem revisada. Nenhum pedido foi apagado.")}
            >
              <CheckCircle2 size={15} />
              Revisar
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white transition hover:bg-white/10"
              type="button"
              onClick={() => setNotice("Financeiro selecionado.")}
            >
              <DollarSign size={15} />
              Caixa
            </button>
          </div>
        </section>

        {menuPanelOpen && (
          <section className="mt-3 shrink-0 rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Integracoes do cardapio
                </p>
                <h2 className="text-xl font-black text-white">Produtos e disponibilidade</h2>
              </div>
              <span className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black ${
                menuAdmin.status === "online"
                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                  : menuAdmin.status === "offline"
                    ? "border-red-300/25 bg-red-400/10 text-red-100"
                    : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
              }`}>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  menuAdmin.status === "online"
                    ? "bg-emerald-300"
                    : menuAdmin.status === "offline"
                      ? "bg-red-300"
                      : "bg-cyan-300"
                }`} />
                {menuConnectionLabel}
              </span>
            </div>

            {menuAdmin.status !== "online" && (
              <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-sm leading-6 text-cyan-50/80">
                Para modificar o cardapio real, configure `VITE_MENU_API_BASE_URL` apontando para o backend que tambem sera usado pelo site do cardapio. Sem isso, o admin nao envia mudancas para o cliente.
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Plus size={16} className="text-orange-300" />
                  {editingCategoryId ? "Editar categoria" : "Nova categoria"}
                </div>

                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Nome</span>
                    <input
                      value={categoryDraft.nome}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, nome: event.target.value })}
                      disabled={!menuAdmin.isConnected}
                      placeholder="Ex: Sobremesas"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descricao</span>
                    <textarea
                      value={categoryDraft.descricao}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, descricao: event.target.value })}
                      disabled={!menuAdmin.isConnected}
                      placeholder="Doces da casa"
                      className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Imagem</span>
                    <input
                      value={categoryDraft.imagem}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, imagem: event.target.value })}
                      disabled={!menuAdmin.isConnected}
                      placeholder="/Sobremesas/banner.jpeg"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Ordem</span>
                    <input
                      type="number"
                      value={categoryDraft.ordem}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, ordem: Number(event.target.value) })}
                      disabled={!menuAdmin.isConnected}
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Categoria ativa
                    <input
                      type="checkbox"
                      checked={categoryDraft.ativo}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, ativo: event.target.checked })}
                      disabled={!menuAdmin.isConnected}
                      className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={saveCategory}
                    disabled={!menuAdmin.isConnected || !categoryDraft.nome.trim()}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={15} />
                    {editingCategoryId ? "Salvar categoria" : "Adicionar categoria"}
                  </button>

                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={cancelCategoryEdit}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <X size={15} />
                      Cancelar edicao
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">Categorias do site</p>
                    <p className="mt-1 text-xs text-zinc-500">A rota publica mostra somente categorias ativas.</p>
                  </div>
                </div>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {menuAdmin.categories.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhuma categoria carregada do backend do cardapio.
                    </div>
                  )}

                  {menuAdmin.categories.map((category) => (
                    <div key={category.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-black text-white">{category.nome}</strong>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                            category.ativo
                              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                              : "border-red-300/25 bg-red-400/10 text-red-100"
                          }`}>
                            {category.ativo ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          Ordem {category.ordem} | {category.descricao || "Sem descricao"} | {category.imagem || "Sem imagem"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!menuAdmin.isConnected}
                          onClick={() => editCategory(category)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Edit3 size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={!menuAdmin.isConnected}
                          onClick={() => toggleCategoryStatus(category)}
                          className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            category.ativo
                              ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]"
                              : "bg-emerald-400 text-black hover:bg-emerald-300"
                          }`}
                        >
                          {category.ativo ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          disabled={!menuAdmin.isConnected}
                          onClick={() => removeCategory(category)}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <main className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)_390px]">
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
                  onClick={() => {
                    setActiveFilter(filter.value)
                    setNotice(`Filtro aplicado: ${filter.label}.`)
                  }}
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
              Ocultar concluidos e cancelados
            </label>

            <button
              className="mt-auto hidden h-10 rounded-lg bg-[#090b18] px-4 text-xs font-black uppercase text-white transition hover:bg-black xl:block"
              type="button"
              onClick={() => {
                setActiveFilter("todos")
                setSearch("")
                setNotice("Mostrando todos os pedidos.")
              }}
            >
              Limpar filtros
            </button>
          </aside>

          <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-3">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Pedidos de hoje</p>
                <h2 className="text-xl font-black text-white">{visibleOrders.length} na tela</h2>
              </div>
              <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400 md:w-80">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                  placeholder="Buscar por cliente ou numero"
                />
              </label>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  isSelected={activeSelectedOrderId === order.id}
                  order={order}
                  onSelect={() => selectOrder(order)}
                />
              ))}

              {visibleOrders.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/[0.12] bg-black/[0.16] p-8 text-center">
                  <p className="text-sm font-bold text-zinc-400">Nenhum pedido encontrado nesse filtro.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">Detalhes do pedido</h2>
                  <MapPin className="text-orange-300" size={20} />
                </div>

                {!selectedOrder && (
                  <div className="mt-8 grid min-h-[360px] place-items-center rounded-lg border border-dashed border-white/[0.12] bg-black/[0.16] p-6 text-center">
                    <div>
                      <PackageCheck className="mx-auto text-zinc-500" size={42} />
                      <h3 className="mt-4 text-lg font-black text-white">Nenhum pedido foi selecionado</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Escolha um balão de pedido ao lado para acompanhar os detalhes.
                      </p>
                    </div>
                  </div>
                )}

                {selectedOrder && (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                          >
                            <Save size={15} />
                            Salvar edicao
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false)
                              setDraft(null)
                              setNotice(`Edicao do pedido #${selectedOrder.id} cancelada.`)
                            }}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                          >
                            <X size={15} />
                            Cancelar edicao
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedOrder.status === "novo" && (
                            <button
                              type="button"
                              onClick={() => updateSelectedOrder({ status: "preparando" }, `Pedido #${selectedOrder.id} aprovado.`)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-xs font-black text-black transition hover:bg-emerald-300"
                            >
                              <Check size={15} />
                              Aprovar pedido
                            </button>
                          )}

                          {selectedOrder.status !== "cancelado" && selectedOrder.status !== "concluido" && (
                            <button
                              type="button"
                              onClick={startEdit}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                            >
                              <Edit3 size={15} />
                              Editar pedido
                            </button>
                          )}

                          {(selectedOrder.status === "preparando" || selectedOrder.status === "saiu") && (
                            <button
                              type="button"
                              onClick={() => updateSelectedOrder({ status: "concluido" }, `Pedido #${selectedOrder.id} concluido.`)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-xs font-black text-black transition hover:bg-emerald-300"
                            >
                              <CheckCircle2 size={15} />
                              Concluir pedido
                            </button>
                          )}

                          {(selectedOrder.status === "concluido" || selectedOrder.status === "cancelado") && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedOrder(
                                  { cancelReason: undefined, status: "preparando" },
                                  `Pedido #${selectedOrder.id} restaurado para preparo.`
                                )
                              }
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/[0.24]"
                            >
                              <CheckCircle2 size={15} />
                              Restaurar pedido
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {(selectedOrder.status === "concluido" || selectedOrder.status === "cancelado") && (
                      <div
                        className={`rounded-lg border p-3 ${
                          selectedOrder.status === "cancelado"
                            ? "border-red-300/35 bg-red-400/10 text-red-100"
                            : "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em]">
                          {selectedOrder.status === "cancelado" ? "Pedido cancelado" : "Pedido concluido"}
                        </p>
                        <p className="mt-1 text-sm leading-5 opacity-80">
                          Este pedido saiu da fila ativa. Use restaurar pedido se isso aconteceu por engano.
                        </p>
                      </div>
                    )}

                    <div className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">
                          Pedido #{selectedOrder.id}
                        </span>
                        <span className="rounded-full border border-orange-300/30 bg-orange-400/10 px-3 py-1 text-xs font-black uppercase text-orange-200">
                          {statusLabels[selectedOrder.status] ?? selectedOrder.status}
                        </span>
                      </div>

                      <div className="mt-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-black text-white">
                            {selectedOrder.customer}
                          </h3>
                          {selectedOrder.cancelReason && (
                            <p className="mt-2 text-xs font-bold text-red-100/80">
                              Motivo do cancelamento: {selectedOrder.cancelReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing && draft ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Cliente</span>
                          <input
                            value={draft.customer}
                            onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Telefone</span>
                          <input
                            value={draft.phone}
                            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Endereco ou mesa</span>
                          <input
                            value={draft.address}
                            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Categoria do pedido</span>
                          <select
                            value={draft.delivery}
                            onChange={(event) => setDraft({ ...draft, delivery: event.target.value as DeliveryType })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          >
                            {deliveryOptions.map((delivery) => (
                              <option key={delivery} value={delivery}>
                                {delivery}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3 text-sm text-zinc-200">
                          <User size={17} className="text-orange-300" />
                          {selectedOrder.customer}
                        </p>
                        <p className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3 text-sm text-zinc-200">
                          <Phone size={17} className="text-orange-300" />
                          {selectedOrder.phone}
                        </p>
                        <p className="flex items-start gap-3 rounded-lg bg-white/[0.04] p-3 text-sm text-zinc-200">
                          <MapPin size={17} className="mt-0.5 shrink-0 text-orange-300" />
                          {selectedOrder.address}
                        </p>
                      </div>
                    )}

                    <div className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                      <div className={`mb-4 flex items-center gap-3 rounded-lg border p-3 ${deliveryStyles[selectedOrder.delivery] ?? deliveryStyles.Retirada}`}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/20">
                          <SelectedDeliveryIcon size={19} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                            Forma do pedido
                          </p>
                          <strong className="block truncate text-lg font-black uppercase">
                            {selectedOrder.delivery}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-black uppercase text-zinc-500">Tipo</p>
                          <strong className="mt-1 block text-sm text-white">{selectedOrder.delivery}</strong>
                        </div>
                        {isEditing && draft ? (
                          <>
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-black uppercase text-zinc-500">Pagamento</span>
                              <select
                                value={paymentOptions.includes(draft.payment) ? draft.payment : "Outro"}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    payment: event.target.value === "Outro" ? "" : event.target.value,
                                  })
                                }
                                className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                              >
                                {paymentOptions.map((payment) => (
                                  <option key={payment} value={payment}>
                                    {payment}
                                  </option>
                                ))}
                                <option value="Outro">Outro</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-black uppercase text-zinc-500">Total</span>
                              <input
                                type="number"
                                value={draft.total}
                                onChange={(event) => setDraft({ ...draft, total: Number(event.target.value) })}
                                className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-[11px] font-black uppercase text-zinc-500">Pagamento</p>
                              <strong className="mt-1 block text-sm text-white">{selectedOrder.payment}</strong>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase text-zinc-500">Total</p>
                              <strong className="mt-1 block text-sm text-orange-200">R$ {selectedOrder.total}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      {isEditing && draft && !paymentOptions.includes(draft.payment) && (
                        <label className="mt-3 block">
                          <span className="mb-2 block text-[11px] font-black uppercase text-zinc-500">Outra forma de pagamento</span>
                          <input
                            value={draft.payment}
                            onChange={(event) => setDraft({ ...draft, payment: event.target.value })}
                            placeholder="Ex: Voucher, transferencia, cortesia"
                            className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                          />
                        </label>
                      )}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-[11px] font-black uppercase text-zinc-500">Tempo do pedido</p>
                          <strong className="mt-1 block text-sm text-white">{selectedOrder.time}</strong>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-[11px] font-black uppercase text-zinc-500">Contato</p>
                          <strong className="mt-1 block text-sm text-white">{selectedOrder.phone}</strong>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-[11px] font-black uppercase text-zinc-500">Itens do pedido</p>
                        <div className="mt-2 space-y-2">
                          {selectedOrder.items.map((item) => (
                            <div key={item} className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] font-black uppercase text-zinc-500">Observacoes</p>
                        {isEditing && draft ? (
                          <textarea
                            value={draft.notes}
                            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                            placeholder="Ex: sem cebola, trocar refrigerante, cliente pediu troco..."
                            className="mt-2 min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                          />
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-zinc-200">
                            {selectedOrder.notes || "Sem observacoes para este pedido."}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isEditing && selectedOrder.status !== "cancelado" && selectedOrder.status !== "concluido" && (
                      <div className="rounded-lg border border-red-300/20 bg-red-400/[0.06] p-3">
                        {!isCanceling ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold text-red-100/60">
                              Area de cancelamento
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelReason(cancelReasons[0])
                                setIsCanceling(true)
                                setNotice(`Escolha o motivo para cancelar o pedido #${selectedOrder.id}.`)
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-300/25 bg-red-400/10 px-2.5 text-[11px] font-black text-red-100 transition hover:bg-red-400/[0.18]"
                            >
                              <XCircle size={13} />
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-black uppercase text-red-100/70">
                                Motivo do cancelamento
                              </span>
                              <select
                                value={cancelReason}
                                onChange={(event) => setCancelReason(event.target.value)}
                                className="h-10 w-full rounded-lg border border-red-300/25 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-red-300/70"
                              >
                                {cancelReasons.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCanceling(false)
                                  setNotice(`Cancelamento do pedido #${selectedOrder.id} fechado.`)
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                              >
                                Voltar
                              </button>
                              <button
                                type="button"
                                onClick={confirmCancel}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-300/35 bg-red-400/15 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.22]"
                              >
                                <XCircle size={14} />
                                Confirmar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </aside>
        </main>
      </div>
    </MainLayout>
  )
}
