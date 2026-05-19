import { useMemo, useState } from "react"
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquareText,
  PackageCheck,
  Plus,
  Phone,
  ReceiptText,
  Save,
  Search,
  Settings,
  Store,
  Truck,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react"

import { OrderCard } from "../components/order-card"
import { useLiveOrders } from "../hooks/use-live-orders"
import { useMenuAdmin } from "../hooks/use-menu-admin"
import { useNewOrderSound } from "../hooks/use-new-order-sound"
import { MainLayout } from "../layouts/main-layout"
import type {
  MenuAdditional,
  MenuAdditionalDraft,
  MenuCategory,
  MenuCategoryDraft,
  MenuProduct,
  MenuProductDraft,
} from "../types/menu"
import type { DeliveryType, Order } from "../types/order"

type DashboardProps = {
  onLogout: () => void
}

type OrderFilter = "todos" | "mesa" | "retirada" | "entrega"
type StatusFilter = "todos" | Order["status"]
type MenuPanelSection = "categorias" | "produtos" | "adicionais"
type DiscountMode = "valor" | "percentual"
type CashTab = "todos" | "hamburgueres" | "cachorros" | "refrigerantes" | "adicionais" | "outros"
type MainPanel = "pedidos" | "cardapio" | "caixa" | "clientes"
type OrderDraft = Pick<Order, "address" | "customer" | "delivery" | "items" | "notes" | "payment" | "phone" | "total">

const statusLabels: Record<string, string> = {
  novo: "Aguardando aprovacao",
  preparando: "Em preparacao",
  saiu: "Pronto",
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

const emptyProductDraft: MenuProductDraft = {
  ativo: true,
  categoriaId: 0,
  descricao: "",
  highlight: "",
  imagem: "",
  nome: "",
  preco: 0,
}

const emptyAdditionalDraft: MenuAdditionalDraft = {
  ativo: true,
  descricao: "",
  nome: "",
  preco: 0,
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

const cashTabLabels: Record<CashTab, string> = {
  adicionais: "Adicionais",
  cachorros: "Cachorros quentes",
  hamburgueres: "Hamburgueres",
  outros: "Outros",
  refrigerantes: "Refrigerantes",
  todos: "Tudo que saiu",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value)
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getOrderDateInputValue(order: Order) {
  if (!order.createdAtTimestamp) return getLocalDateInputValue()

  return getLocalDateInputValue(new Date(order.createdAtTimestamp))
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "") || phone
}

function getPaymentBucket(payment: string) {
  const normalized = payment.toLowerCase()

  if (normalized.includes("pix")) return "pix"
  if (normalized.includes("dinheiro")) return "dinheiro"
  if (normalized.includes("cart")) return "cartao"

  return "outros"
}

function getCashCategory(itemName: string): CashTab {
  const normalized = itemName.toLowerCase()

  if (normalized.includes("coca") || normalized.includes("guarana") || normalized.includes("refri") || normalized.includes("suco") || normalized.includes("agua")) {
    return "refrigerantes"
  }

  if (normalized.includes("hot") || normalized.includes("dog") || normalized.includes("cachorro")) {
    return "cachorros"
  }

  if (normalized.includes("x-") || normalized.includes("burger") || normalized.includes("burguer") || normalized.includes("hamb")) {
    return "hamburgueres"
  }

  if (normalized.includes("adicional") || normalized.includes("bacon") || normalized.includes("cheddar") || normalized.includes("catupiry")) {
    return "adicionais"
  }

  return "outros"
}

function parseCashItem(rawItem: string) {
  const quantityMatch = rawItem.match(/^(\d+)\s*x\s*/i)
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1
  const withoutQuantity = rawItem.replace(/^(\d+)\s*x\s*/i, "")
  const name = withoutQuantity.split(" + ")[0]?.split(" (")[0]?.trim() || rawItem

  return {
    category: getCashCategory(name),
    name,
    quantity,
  }
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
    applyOrderChanges,
    updateOrder,
    updateStoreStatus,
  } = useLiveOrders()
  const menuAdmin = useMenuAdmin()
  const [selectedOrderId, setSelectedOrderId] = useState<number>()
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("todos")
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("todos")
  const [search, setSearch] = useState("")
  const [hideFinished, setHideFinished] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [storeOpen, setStoreOpen] = useState(true)
  const [notice, setNotice] = useState("Painel de gestão ")
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelReason, setCancelReason] = useState(cancelReasons[0])
  const [categoryDraft, setCategoryDraft] = useState<MenuCategoryDraft>(emptyCategoryDraft)
  const [categoryFeedback, setCategoryFeedback] = useState("")
  const [categorySaving, setCategorySaving] = useState(false)
  const [productDraft, setProductDraft] = useState<MenuProductDraft>(emptyProductDraft)
  const [productSearch, setProductSearch] = useState("")
  const [productCategoryFilter, setProductCategoryFilter] = useState(0)
  const [additionalDraft, setAdditionalDraft] = useState<MenuAdditionalDraft>(emptyAdditionalDraft)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editingAdditionalId, setEditingAdditionalId] = useState<number | null>(null)
  const [menuPanelSection, setMenuPanelSection] = useState<MenuPanelSection>("categorias")
  const [menuPanelOpen, setMenuPanelOpen] = useState(false)
  const [cashPanelOpen, setCashPanelOpen] = useState(false)
  const [clientsPanelOpen, setClientsPanelOpen] = useState(false)
  const [cashTab, setCashTab] = useState<CashTab>("todos")
  const [reportDate, setReportDate] = useState(getLocalDateInputValue())
  const [selectedClientPhone, setSelectedClientPhone] = useState("")
  const [clientNotes, setClientNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("pitsdog:admin:client-notes:v1") ?? "{}") as Record<string, string>
    } catch {
      return {}
    }
  })
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [discountMode, setDiscountMode] = useState<DiscountMode>("valor")
  const [discountValue, setDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState("")
  const [discountOrderId, setDiscountOrderId] = useState<number | null>(null)
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const orderSound = useNewOrderSound(orderList, { enabled: soundEnabled })

  const activeSelectedOrderId = selectedOrderId ?? orderList[0]?.id
  const selectedOrder = orderList.find((order) => order.id === activeSelectedOrderId)
  const discountOrder = orderList.find((order) => order.id === discountOrderId)

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
      status: "novo" as StatusFilter,
    },
    {
      label: "Atualizado",
      value: "0",
      detail: "sem pendencias",
      icon: CheckCircle2,
      status: "todos" as StatusFilter,
    },
    {
      label: "Em preparacao",
      value: String(counts.preparando),
      detail: "na cozinha",
      icon: PackageCheck,
      status: "preparando" as StatusFilter,
    },
    {
      label: "Pronto",
      value: String(counts.saiu),
      detail: "aguardando saida",
      icon: Truck,
      status: "saiu" as StatusFilter,
    },
    {
      label: "Pronto retirada",
      value: String(counts.retirada),
      detail: "aguardando cliente",
      icon: Store,
      status: "todos" as StatusFilter,
    },
    {
      label: "Agendado",
      value: "1",
      detail: "para hoje",
      icon: CalendarDays,
      status: "todos" as StatusFilter,
    },
    {
      label: "Cancelado",
      value: String(counts.cancelado),
      detail: "pedidos cancelados",
      icon: XCircle,
      status: "cancelado" as StatusFilter,
    },
    {
      label: "Concluido",
      value: String(counts.concluido),
      detail: "pedidos finalizados",
      icon: CheckCircle2,
      status: "concluido" as StatusFilter,
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
      const matchesStatus = activeStatusFilter === "todos" || order.status === activeStatusFilter

      return matchesFilter(order, activeFilter) && matchesSearch && matchesFinished && matchesStatus
    })
  }, [activeFilter, activeStatusFilter, hideFinished, orderList, search])

  const visibleProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()

    return menuAdmin.products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.nome.toLowerCase().includes(normalizedSearch) ||
        product.descricao.toLowerCase().includes(normalizedSearch) ||
        (product.highlight ?? product.subtitle ?? "").toLowerCase().includes(normalizedSearch)
      const matchesCategory =
        productCategoryFilter === 0 || product.categoriaId === productCategoryFilter

      return matchesSearch && matchesCategory
    })
  }, [menuAdmin.products, productCategoryFilter, productSearch])

  const productGroups = useMemo(() => {
    const categoriesById = new Map(menuAdmin.categories.map((category) => [category.id, category]))
    const groupedProducts = new Map<number, MenuProduct[]>()

    visibleProducts.forEach((product) => {
      const groupId = categoriesById.has(product.categoriaId) ? product.categoriaId : 0
      const currentProducts = groupedProducts.get(groupId) ?? []

      groupedProducts.set(groupId, [...currentProducts, product])
    })

    return [...groupedProducts.entries()]
      .map(([categoryId, products]) => ({
        categoryId,
        categoryName: categoriesById.get(categoryId)?.nome ?? "Sem categoria",
        products,
      }))
      .sort((first, second) => {
        if (first.categoryId === 0) return 1
        if (second.categoryId === 0) return -1
        return first.categoryName.localeCompare(second.categoryName)
      })
  }, [menuAdmin.categories, visibleProducts])

  const cashOrders = useMemo(
    () => orderList.filter((order) => order.status !== "cancelado"),
    [orderList]
  )
  const reportOrders = useMemo(
    () => cashOrders.filter((order) => getOrderDateInputValue(order) === reportDate),
    [cashOrders, reportDate]
  )
  const cashItems = useMemo(() => {
    const itemMap = new Map<string, { category: CashTab; name: string; quantity: number }>()

    reportOrders.forEach((order) => {
      order.items.forEach((rawItem) => {
        const item = parseCashItem(rawItem)
        const currentItem = itemMap.get(item.name)

        if (currentItem) {
          itemMap.set(item.name, {
            ...currentItem,
            quantity: currentItem.quantity + item.quantity,
          })
          return
        }

        itemMap.set(item.name, item)
      })
    })

    return [...itemMap.values()].sort((first, second) => second.quantity - first.quantity)
  }, [reportOrders])
  const visibleCashItems = cashTab === "todos"
    ? cashItems
    : cashItems.filter((item) => item.category === cashTab)
  const completedRevenue = reportOrders
    .filter((order) => order.status === "concluido")
    .reduce((total, order) => total + order.total, 0)
  const openRevenue = reportOrders
    .filter((order) => order.status !== "concluido")
    .reduce((total, order) => total + order.total, 0)
  const completedOrdersCount = reportOrders.filter((order) => order.status === "concluido").length
  const averageTicket = completedOrdersCount ? completedRevenue / completedOrdersCount : 0
  const paymentSummary = useMemo(() => {
    const summary = { cartao: 0, dinheiro: 0, outros: 0, pix: 0 }

    reportOrders
      .filter((order) => order.status === "concluido")
      .forEach((order) => {
        summary[getPaymentBucket(order.payment)] += order.total
      })

    return summary
  }, [reportOrders])
  const clientProfiles = useMemo(() => {
    const clients = new Map<string, {
      addresses: Set<string>
      lastOrder?: Order
      name: string
      orders: Order[]
      phone: string
      total: number
    }>()

    orderList.forEach((order) => {
      const key = normalizePhone(order.phone)
      const currentClient = clients.get(key) ?? {
        addresses: new Set<string>(),
        name: order.customer,
        orders: [],
        phone: order.phone,
        total: 0,
      }

      currentClient.orders.push(order)
      currentClient.total += order.status === "cancelado" ? 0 : order.total
      currentClient.name = currentClient.name || order.customer
      currentClient.phone = currentClient.phone || order.phone
      if (order.address && order.address !== "-") currentClient.addresses.add(order.address)
      if (!currentClient.lastOrder || (order.createdAtTimestamp ?? 0) > (currentClient.lastOrder.createdAtTimestamp ?? 0)) {
        currentClient.lastOrder = order
      }

      clients.set(key, currentClient)
    })

    return [...clients.entries()]
      .map(([key, client]) => ({
        ...client,
        addresses: [...client.addresses],
        key,
      }))
      .sort((first, second) => second.orders.length - first.orders.length)
  }, [orderList])
  const selectedClient = clientProfiles.find((client) => client.key === selectedClientPhone) ?? clientProfiles[0]

  function selectOrder(order: Order) {
    setSelectedOrderId(order.id)
    setIsEditing(false)
    setIsCanceling(false)
    setDraft(null)
    setNotice(`Pedido #${order.id} selecionado.`)
  }

  function updateClientNote(clientKey: string, note: string) {
    const nextNotes = { ...clientNotes, [clientKey]: note }

    setClientNotes(nextNotes)
    window.localStorage.setItem("pitsdog:admin:client-notes:v1", JSON.stringify(nextNotes))
  }

  function exportDailyReport() {
    const rows = [
      ["Pedido", "Cliente", "Telefone", "Status", "Entrega", "Pagamento", "Total", "Horario"],
      ...reportOrders.map((order) => [
        `#${order.id}`,
        order.customer,
        order.phone,
        statusLabels[order.status] ?? order.status,
        order.delivery,
        order.payment,
        String(order.total).replace(".", ","),
        order.time,
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = `fechamento-pitsdog-${reportDate}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    setNotice(`Relatorio de ${reportDate} exportado.`)
  }

  async function updateSelectedOrder(changes: Partial<Order>, message: string) {
    if (!selectedOrder) return false

    const orderId = selectedOrder.backendId ?? selectedOrder.id
    const previousOrder = selectedOrder

    applyOrderChanges(orderId, changes)
    setNotice(message)

    const updated = await updateOrder(orderId, changes)

    if (!updated) {
      applyOrderChanges(orderId, previousOrder)
      setNotice("Nao foi possivel salvar na API agora. Alteracao desfeita.")
    }

    return updated
  }

  function startEdit() {
    if (!selectedOrder) return

    setDraft({
      address: selectedOrder.address,
      customer: selectedOrder.customer,
      delivery: selectedOrder.delivery,
      items: selectedOrder.items.length ? selectedOrder.items : [""],
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

    const updated = await updateSelectedOrder({
      ...draft,
      items: draft.items.map((item) => item.trim()).filter(Boolean),
    }, `Pedido #${selectedOrder.id} atualizado no painel.`)

    if (updated) {
      setIsEditing(false)
      setDraft(null)
    }
  }

  async function confirmCancel() {
    if (!selectedOrder) return

    setIsCanceling(false)

    const updated = await updateSelectedOrder(
      { cancelReason, status: "cancelado" },
      `Pedido #${selectedOrder.id} cancelado. Motivo: ${cancelReason}.`
    )

    if (!updated) setIsCanceling(true)
  }

  async function saveCategory() {
    if (!categoryDraft.nome.trim()) {
      const message = "Informe o nome da categoria para salvar."

      setCategoryFeedback(message)
      setNotice(message)
      return
    }

    setCategorySaving(true)
    setCategoryFeedback("Salvando categoria na API...")
    setNotice("Salvando categoria na API...")

    try {
      if (editingCategoryId) {
        await menuAdmin.updateCategory(editingCategoryId, categoryDraft)
        setNotice(`${categoryDraft.nome} atualizado no cardapio.`)
        setCategoryFeedback(`${categoryDraft.nome} atualizado no cardapio.`)
      } else {
        await menuAdmin.createCategory(categoryDraft)
        setNotice(`${categoryDraft.nome} cadastrado no cardapio.`)
        setCategoryFeedback(`${categoryDraft.nome} cadastrado no cardapio.`)
      }

      setCategoryDraft(emptyCategoryDraft)
      setEditingCategoryId(null)
    } catch (error) {
      console.error("Erro ao salvar categoria", error)
      setNotice("Nao foi possivel salvar a categoria na API agora.")
      setCategoryFeedback("Nao foi possivel salvar a categoria na API agora. Veja o console para o erro da API.")
    } finally {
      setCategorySaving(false)
    }
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
    setCategoryFeedback("")
    setNotice("Edicao de categoria cancelada.")
  }

  async function toggleCategoryStatus(category: MenuCategory) {
    const nextStatus = !category.ativo

    menuAdmin.applyCategoryStatus(category.id, nextStatus)
    setNotice(nextStatus ? "Categoria ativada no painel." : "Categoria desativada no painel.")

    try {
      await menuAdmin.updateCategoryStatus(category.id, nextStatus)
      setNotice(nextStatus ? "Categoria ativada no cardapio." : "Categoria desativada no cardapio.")
    } catch {
      menuAdmin.applyCategoryStatus(category.id, category.ativo)
      setNotice("Nao foi possivel alterar a categoria na API agora.")
    }
  }

  async function removeCategory(category: MenuCategory) {
    if (!window.confirm(`Excluir a categoria ${category.nome}?`)) return

    menuAdmin.removeCategoryFromPanel(category.id)
    setNotice(`${category.nome} removida do painel.`)

    try {
      await menuAdmin.deleteCategory(category.id)
      setNotice(`${category.nome} removida do cardapio.`)
    } catch {
      menuAdmin.restoreCategory(category)
      setNotice("Nao foi possivel excluir a categoria na API agora.")
    }
  }

  async function saveProduct() {
    if (!productDraft.nome.trim() || !productDraft.categoriaId) {
      setNotice("Informe nome e categoria para salvar o produto.")
      return
    }

    try {
      if (editingProductId) {
        await menuAdmin.updateProduct(editingProductId, productDraft)
        setNotice(`${productDraft.nome} atualizado no cardapio.`)
      } else {
        await menuAdmin.createProduct(productDraft)
        setNotice(`${productDraft.nome} cadastrado no cardapio.`)
      }

      setProductDraft(emptyProductDraft)
      setEditingProductId(null)
    } catch {
      setNotice("Nao foi possivel salvar o produto na API agora.")
    }
  }

  function editProduct(product: MenuProduct) {
    setEditingProductId(product.id)
    setProductDraft({
      ativo: product.ativo,
      categoriaId: product.categoriaId,
      descricao: product.descricao,
      highlight: product.highlight ?? product.subtitle ?? "",
      imagem: product.imageUrl ?? product.imagem ?? "",
      nome: product.nome,
      preco: product.preco,
    })
    setMenuPanelSection("produtos")
    setNotice(`Editando produto ${product.nome}.`)
  }

  function cancelProductEdit() {
    setProductDraft(emptyProductDraft)
    setEditingProductId(null)
    setNotice("Edicao de produto cancelada.")
  }

  async function toggleProductStatus(product: MenuProduct) {
    const nextStatus = !product.ativo

    menuAdmin.applyProductStatus(product.id, nextStatus)
    setNotice(nextStatus ? "Produto ativado no painel." : "Produto desativado no painel.")

    try {
      await menuAdmin.updateProductStatus(product)
      setNotice(nextStatus ? "Produto ativado no cardapio." : "Produto desativado no cardapio.")
    } catch {
      menuAdmin.applyProductStatus(product.id, product.ativo)
      setNotice("Nao foi possivel alterar o produto na API agora.")
    }
  }

  async function removeProduct(product: MenuProduct) {
    if (!window.confirm(`Excluir o produto ${product.nome}?`)) return

    menuAdmin.removeProductFromPanel(product.id)
    setNotice(`${product.nome} removido do painel.`)

    try {
      await menuAdmin.deleteProduct(product.id)
      setNotice(`${product.nome} removido do cardapio.`)
    } catch {
      menuAdmin.restoreProduct(product)
      setNotice("Nao foi possivel excluir o produto na API agora.")
    }
  }

  async function saveAdditional() {
    if (!additionalDraft.nome.trim()) {
      setNotice("Informe o nome do adicional.")
      return
    }

    try {
      if (editingAdditionalId) {
        await menuAdmin.updateAdditional(editingAdditionalId, additionalDraft)
        setNotice(`${additionalDraft.nome} atualizado no cardapio.`)
      } else {
        await menuAdmin.createAdditional(additionalDraft)
        setNotice(`${additionalDraft.nome} cadastrado no cardapio.`)
      }

      setAdditionalDraft(emptyAdditionalDraft)
      setEditingAdditionalId(null)
    } catch {
      setNotice("Nao foi possivel salvar o adicional na API agora.")
    }
  }

  function editAdditional(additional: MenuAdditional) {
    setEditingAdditionalId(additional.id)
    setAdditionalDraft({
      ativo: additional.ativo,
      descricao: additional.descricao,
      nome: additional.nome,
      preco: additional.preco,
    })
    setMenuPanelSection("adicionais")
    setNotice(`Editando adicional ${additional.nome}.`)
  }

  function cancelAdditionalEdit() {
    setAdditionalDraft(emptyAdditionalDraft)
    setEditingAdditionalId(null)
    setNotice("Edicao de adicional cancelada.")
  }

  async function toggleAdditionalStatus(additional: MenuAdditional) {
    const nextStatus = !additional.ativo

    menuAdmin.applyAdditionalStatus(additional.id, nextStatus)
    setNotice(nextStatus ? "Adicional ativado no painel." : "Adicional desativado no painel.")

    try {
      await menuAdmin.updateAdditionalStatus(additional)
      setNotice(nextStatus ? "Adicional ativado no cardapio." : "Adicional desativado no cardapio.")
    } catch {
      menuAdmin.applyAdditionalStatus(additional.id, additional.ativo)
      setNotice("Nao foi possivel alterar o adicional na API agora.")
    }
  }

  async function removeAdditional(additional: MenuAdditional) {
    if (!window.confirm(`Excluir o adicional ${additional.nome}?`)) return

    menuAdmin.removeAdditionalFromPanel(additional.id)
    setNotice(`${additional.nome} removido do painel.`)

    try {
      await menuAdmin.deleteAdditional(additional.id)
      setNotice(`${additional.nome} removido do cardapio.`)
    } catch {
      menuAdmin.restoreAdditional(additional)
      setNotice("Nao foi possivel excluir o adicional na API agora.")
    }
  }

  async function applyDiscount() {
    if (!discountOrder) return

    if (discountValue <= 0 || !discountReason.trim()) {
      setNotice("Informe o valor e o motivo do desconto.")
      return
    }

    const orderId = discountOrder.backendId ?? discountOrder.id
    const previousOrder = discountOrder
    const changes = {
      discount: discountMode === "valor" ? discountValue : undefined,
      discountPercent: discountMode === "percentual" ? discountValue : undefined,
      discountReason,
    }

    applyOrderChanges(orderId, changes)
    setNotice(`Desconto aplicado ao pedido #${discountOrder.id}.`)

    const updated = await updateOrder(orderId, changes)

    if (!updated) {
      applyOrderChanges(orderId, previousOrder)
      setNotice("Nao foi possivel salvar o desconto na API agora. Alteracao desfeita.")
    }

    if (updated) {
      setDiscountValue(0)
      setDiscountReason("")
      setDiscountOrderId(null)
    }
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
  const activePanel = menuPanelOpen ? "cardapio" : cashPanelOpen ? "caixa" : clientsPanelOpen ? "clientes" : "pedidos"
  const navigationItems = [
    { description: `${visibleOrders.length} na tela`, icon: LayoutDashboard, label: "Pedidos", value: "pedidos" },
    { description: `${menuAdmin.products.length} produtos`, icon: Settings, label: "Cardapio", value: "cardapio" },
    { description: formatCurrency(completedRevenue), icon: DollarSign, label: "Caixa", value: "caixa" },
    { description: `${clientProfiles.length} contatos`, icon: Users, label: "Clientes", value: "clientes" },
  ] as const

  function showPanel(panel: MainPanel) {
    setMenuPanelOpen(panel === "cardapio")
    setCashPanelOpen(panel === "caixa")
    setClientsPanelOpen(panel === "clientes")
    setNotice(
      panel === "pedidos"
        ? "Tela principal de pedidos aberta."
        : panel === "cardapio"
          ? "Gerenciamento do cardapio aberto."
          : panel === "caixa"
            ? "Fluxo de caixa aberto."
            : "Historico de clientes aberto."
    )
  }

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

            <nav className="grid gap-2 rounded-lg border border-white/10 bg-black/[0.22] p-1 sm:grid-cols-2 xl:min-w-[560px] xl:grid-cols-4" aria-label="Navegacao principal">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activePanel === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => showPanel(item.value)}
                    className={`flex min-h-14 items-center gap-3 rounded-lg px-3 text-left transition ${
                      isActive
                        ? "bg-orange-400 text-black shadow-[0_14px_32px_rgba(255,106,0,0.22)]"
                        : "text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      isActive ? "bg-black/15" : "bg-white/[0.06]"
                    }`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm font-black">{item.label}</strong>
                      <span className={`block truncate text-[11px] font-bold ${isActive ? "text-black/65" : "text-zinc-500"}`}>
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>

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
              {soundEnabled && orderSound.needsActivation && (
                <button
                  type="button"
                  onClick={async () => {
                    await orderSound.activateSound()
                    setNotice("Som de pedidos ativado neste navegador.")
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                >
                  <Volume2 size={15} />
                  Ativar som
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled((value) => !value)
                  setNotice(soundEnabled ? "Som de pedidos desativado." : "Som de pedidos ativado.")
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black transition ${
                  soundEnabled
                    ? "border-orange-300/35 bg-orange-400/10 text-orange-100 hover:bg-orange-400/[0.18]"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
                aria-pressed={soundEnabled}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                Som de pedidos
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
                href="https://pits-dog-oficial.netlify.app/"
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
                  <button
                    key={metric.label}
                    type="button"
                    onClick={() => {
                      setActiveStatusFilter(metric.status)
                      showPanel("pedidos")
                      setNotice(metric.status === "todos" ? "Mostrando todos os pedidos." : `Filtro aplicado: ${metric.label}.`)
                    }}
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
              Operacao
            </div>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-black ${menuSignal.className}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${menuSignal.dotClassName}`} />
              {menuSignal.label}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white">
              <CheckCircle2 size={15} />
              {lastSync ? `Sync ${lastSync}` : "Sincronizando"}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white">
              <DollarSign size={15} />
              {cashOrders.length} pedidos no caixa
            </div>
          </div>
        </section>

        {discountOrder && (
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
                  value={discountValue}
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
                  onClick={applyDiscount}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                >
                  <Save size={14} />
                  Aplicar
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountOrderId(null)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                >
                  <X size={14} />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {menuPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Integracoes do cardapio
                </p>
                <h2 className="text-xl font-black text-white">Produtos e disponibilidade</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => showPanel("pedidos")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                >
                  <LayoutDashboard size={15} />
                  Voltar aos pedidos
                </button>
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
            </div>

            {menuAdmin.status !== "online" && (
              <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-sm leading-6 text-cyan-50/80">
                {menuAdmin.status === "not-configured"
                  ? "Configure VITE_MENU_API_BASE_URL no admin e reinicie o servidor do Vite para liberar alteracoes reais do cardapio."
                  : "O admin tem URL de backend configurada, mas nao conseguiu carregar o cardapio agora. Confira o console do navegador ou reinicie o servidor do Vite para recarregar o .env.local."}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ["categorias", "Categorias", menuAdmin.categories.length],
                ["produtos", "Produtos", menuAdmin.products.length],
                ["adicionais", "Adicionais", menuAdmin.additionals.length],
              ] as Array<[MenuPanelSection, string, number]>).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMenuPanelSection(value)}
                  className={`h-9 rounded-lg px-3 text-xs font-black transition ${
                    menuPanelSection === value
                      ? "bg-orange-400 text-black"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {menuPanelSection === "categorias" && (
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
                      placeholder="Ex: Sobremesas"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descricao</span>
                    <textarea
                      value={categoryDraft.descricao}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, descricao: event.target.value })}
                      placeholder="Doces da casa"
                      className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Imagem</span>
                    <input
                      value={categoryDraft.imagem}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, imagem: event.target.value })}
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
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Categoria ativa
                    <input
                      type="checkbox"
                      checked={categoryDraft.ativo}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, ativo: event.target.checked })}
                      className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={saveCategory}
                    disabled={categorySaving}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={15} />
                    {categorySaving ? "Salvando..." : editingCategoryId ? "Salvar categoria" : "Adicionar categoria"}
                  </button>

                  {categoryFeedback && (
                    <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-200">
                      {categoryFeedback}
                    </p>
                  )}

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
                          onClick={() => editCategory(category)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Edit3 size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
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
            )}

            {menuPanelSection === "produtos" && (
              <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Plus size={16} className="text-orange-300" />
                    {editingProductId ? "Editar produto" : "Novo produto"}
                  </div>

                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Nome</span>
                      <input
                        value={productDraft.nome}
                        onChange={(event) => setProductDraft({ ...productDraft, nome: event.target.value })}
                        placeholder="Ex: X-Bacon"
                        className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Destaque / subtitulo</span>
                      <input
                        value={productDraft.highlight}
                        onChange={(event) => setProductDraft({ ...productDraft, highlight: event.target.value })}
                        placeholder="Ex: Da casa, Mais vendido, Novo"
                        className="h-10 w-full rounded-lg border border-orange-300/20 bg-orange-400/[0.06] px-3 text-sm text-white outline-none placeholder:text-orange-100/35 focus:border-orange-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="mt-1 text-[11px] font-bold text-orange-100/55">
                        Aparece abaixo do nome do produto no cardapio.
                      </p>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descricao</span>
                      <textarea
                        value={productDraft.descricao}
                        onChange={(event) => setProductDraft({ ...productDraft, descricao: event.target.value })}
                        placeholder="Pao, carne, queijo, bacon e salada"
                        className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Preco</span>
                        <input
                          type="number"
                          value={productDraft.preco}
                          onChange={(event) => setProductDraft({ ...productDraft, preco: Number(event.target.value) })}
                          className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Categoria</span>
                        <select
                          value={productDraft.categoriaId}
                          onChange={(event) => setProductDraft({ ...productDraft, categoriaId: Number(event.target.value) })}
                          className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value={0}>Selecione</option>
                          {menuAdmin.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Imagem</span>
                      <input
                        value={productDraft.imagem}
                        onChange={(event) => setProductDraft({ ...productDraft, imagem: event.target.value })}
                        placeholder="https://..."
                        className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                      Produto ativo
                      <input
                        type="checkbox"
                        checked={productDraft.ativo}
                        onChange={(event) => setProductDraft({ ...productDraft, ativo: event.target.checked })}
                        className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={saveProduct}
                      disabled={!productDraft.nome.trim() || !productDraft.categoriaId}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={15} />
                      {editingProductId ? "Salvar produto" : "Adicionar produto"}
                    </button>

                    {editingProductId && (
                      <button
                        type="button"
                        onClick={cancelProductEdit}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                      >
                        <X size={15} />
                        Cancelar edicao
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">Produtos do site</p>
                      <p className="mt-1 text-xs text-zinc-500">Busca e categoria funcionam juntas para encontrar itens rapido.</p>
                    </div>
                    <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1 text-xs font-black text-orange-100">
                      {visibleProducts.length} de {menuAdmin.products.length}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400">
                      <Search size={15} />
                      <input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                        placeholder="Pesquisar por nome, descricao ou destaque"
                      />
                    </label>
                    <select
                      value={productCategoryFilter}
                      onChange={(event) => setProductCategoryFilter(Number(event.target.value))}
                      className="h-10 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm font-bold text-white outline-none"
                    >
                      <option value={0}>Todas as categorias</option>
                      {menuAdmin.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProductCategoryFilter(0)}
                      className={`h-8 rounded-lg px-3 text-[11px] font-black transition ${
                        productCategoryFilter === 0
                          ? "bg-orange-400 text-black"
                          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      Todas
                    </button>
                    {menuAdmin.categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setProductCategoryFilter(category.id)}
                        className={`h-8 rounded-lg px-3 text-[11px] font-black transition ${
                          productCategoryFilter === category.id
                            ? "bg-orange-400 text-black"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        {category.nome}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {menuAdmin.products.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                        Nenhum produto carregado do backend do cardapio.
                      </div>
                    )}

                    {menuAdmin.products.length > 0 && visibleProducts.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                        Nenhum produto encontrado nessa busca.
                      </div>
                    )}

                    {productGroups.map((group) => (
                      <div key={group.categoryId} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Categoria</p>
                            <h3 className="text-sm font-black text-white">{group.categoryName}</h3>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-black text-zinc-300">
                            {group.products.length} itens
                          </span>
                        </div>

                        <div className="space-y-2">
                          {group.products.map((product) => {
                            const productHighlight = product.highlight ?? product.subtitle

                            return (
                              <div key={product.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/[0.2] p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="min-w-0">
                                      <strong className="block truncate text-sm font-black text-white">{product.nome}</strong>
                                      {productHighlight && (
                                        <span className="mt-0.5 block truncate text-xs font-black uppercase tracking-[0.08em] text-orange-200">
                                          {productHighlight}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                                      product.ativo
                                        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                                        : "border-red-300/25 bg-red-400/10 text-red-100"
                                    }`}>
                                      {product.ativo ? "Ativo" : "Inativo"}
                                    </span>
                                    <span className="text-xs font-black text-orange-200">R$ {product.preco}</span>
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                                    {product.descricao || "Sem descricao"} | {product.imageUrl ?? product.imagem ?? "Sem imagem"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <button type="button" onClick={() => editProduct(product)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Edit3 size={14} />
                                    Editar
                                  </button>
                                  <button type="button" onClick={() => toggleProductStatus(product)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    product.ativo ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]" : "bg-emerald-400 text-black hover:bg-emerald-300"
                                  }`}>
                                    {product.ativo ? "Desativar" : "Ativar"}
                                  </button>
                                  <button type="button" onClick={() => removeProduct(product)} className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50">
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {menuPanelSection === "adicionais" && (
              <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Plus size={16} className="text-orange-300" />
                    {editingAdditionalId ? "Editar adicional" : "Novo adicional"}
                  </div>

                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Nome</span>
                      <input value={additionalDraft.nome} onChange={(event) => setAdditionalDraft({ ...additionalDraft, nome: event.target.value })} placeholder="Ex: Bacon" className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descricao</span>
                      <textarea value={additionalDraft.descricao} onChange={(event) => setAdditionalDraft({ ...additionalDraft, descricao: event.target.value })} placeholder="Adicional de bacon crocante" className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Preco</span>
                      <input type="number" value={additionalDraft.preco} onChange={(event) => setAdditionalDraft({ ...additionalDraft, preco: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                      Adicional ativo
                      <input type="checkbox" checked={additionalDraft.ativo} onChange={(event) => setAdditionalDraft({ ...additionalDraft, ativo: event.target.checked })} className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <button type="button" onClick={saveAdditional} disabled={!additionalDraft.nome.trim()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
                      <Save size={15} />
                      {editingAdditionalId ? "Salvar adicional" : "Adicionar adicional"}
                    </button>
                    {editingAdditionalId && (
                      <button type="button" onClick={cancelAdditionalEdit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                        <X size={15} />
                        Cancelar edicao
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <p className="text-sm font-black text-white">Adicionais do site</p>
                  <p className="mt-1 text-xs text-zinc-500">O cliente escolhe estes adicionais ao montar o item no cardapio.</p>

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {menuAdmin.additionals.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                        Nenhum adicional carregado do backend do cardapio.
                      </div>
                    )}

                    {menuAdmin.additionals.map((additional) => (
                      <div key={additional.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm font-black text-white">{additional.nome}</strong>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                              additional.ativo ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-red-300/25 bg-red-400/10 text-red-100"
                            }`}>
                              {additional.ativo ? "Ativo" : "Inativo"}
                            </span>
                            <span className="text-xs font-black text-orange-200">R$ {additional.preco}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">{additional.descricao || "Sem descricao"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => editAdditional(additional)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                            <Edit3 size={14} />
                            Editar
                          </button>
                          <button type="button" onClick={() => toggleAdditionalStatus(additional)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            additional.ativo ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]" : "bg-emerald-400 text-black hover:bg-emerald-300"
                          }`}>
                            {additional.ativo ? "Desativar" : "Ativar"}
                          </button>
                          <button type="button" onClick={() => removeAdditional(additional)} className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50">
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {cashPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Caixa e relatorios
                </p>
                <h2 className="text-xl font-black text-white">Fechamento diario</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={reportDate}
                  onChange={(event) => setReportDate(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-xs font-black text-white outline-none"
                />
                <button
                  type="button"
                  onClick={exportDailyReport}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                >
                  <Download size={15} />
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-lg border border-emerald-300/20 bg-emerald-400/[0.08] p-3">
                <p className="text-[10px] font-black uppercase text-emerald-100/70">Faturamento finalizado</p>
                <strong className="mt-2 block text-2xl font-black text-emerald-100">{formatCurrency(completedRevenue)}</strong>
              </article>
              <article className="rounded-lg border border-orange-300/20 bg-orange-400/[0.08] p-3">
                <p className="text-[10px] font-black uppercase text-orange-100/70">Em aberto</p>
                <strong className="mt-2 block text-2xl font-black text-orange-100">{formatCurrency(openRevenue)}</strong>
              </article>
              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <p className="text-[10px] font-black uppercase text-zinc-500">Pedidos no caixa</p>
                <strong className="mt-2 block text-2xl font-black text-white">{reportOrders.length}</strong>
              </article>
              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <p className="text-[10px] font-black uppercase text-zinc-500">Ticket medio real</p>
                <strong className="mt-2 block text-2xl font-black text-white">{formatCurrency(averageTicket)}</strong>
              </article>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Pix", paymentSummary.pix],
                ["Dinheiro", paymentSummary.dinheiro],
                ["Cartao", paymentSummary.cartao],
                ["Outros", paymentSummary.outros],
              ].map(([label, value]) => (
                <article key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] font-black uppercase text-zinc-500">{label}</p>
                  <strong className="mt-1 block text-lg font-black text-white">{formatCurrency(Number(value))}</strong>
                </article>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(cashTabLabels) as CashTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCashTab(tab)}
                  className={`h-9 rounded-lg px-3 text-xs font-black transition ${
                    cashTab === tab
                      ? "bg-orange-400 text-black"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {cashTabLabels[tab]}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">{cashTabLabels[cashTab]}</p>
                      <p className="mt-1 text-xs text-zinc-500">Produtos mais vendidos no dia selecionado.</p>
                  </div>
                  <span className="text-xs font-black text-orange-200">{visibleCashItems.reduce((total, item) => total + item.quantity, 0)} unidades</span>
                </div>

                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {visibleCashItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhuma saida encontrada nessa aba.
                    </div>
                  )}

                  {visibleCashItems.map((item) => (
                    <div key={`${item.category}-${item.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                      <div className="min-w-0">
                        <strong className="text-sm font-black text-white">{item.name}</strong>
                        <p className="mt-1 text-xs text-zinc-500">{cashTabLabels[item.category]}</p>
                      </div>
                      <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1 text-xs font-black text-orange-100">
                        {item.quantity} saiu
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <p className="text-sm font-black text-white">Pedidos considerados</p>
                <p className="mt-1 text-xs text-zinc-500">Cancelados ficam fora do caixa. Finalizados entram no faturamento fechado.</p>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {reportOrders.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhum pedido encontrado para esta data.
                    </div>
                  )}

                  {reportOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-black text-white">Pedido #{order.id}</strong>
                        <span className="text-xs font-black text-orange-200">{formatCurrency(order.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {statusLabels[order.status] ?? order.status} | {order.delivery} | {order.payment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {clientsPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Clientes
                </p>
                <h2 className="text-xl font-black text-white">Historico e recorrencia</h2>
              </div>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-orange-300/25 bg-orange-400/10 px-3 text-xs font-black text-orange-100">
                <Users size={15} />
                {clientProfiles.length} clientes
              </span>
            </div>

            {clientProfiles.length === 0 ? (
              <div className="mt-4 grid min-h-[360px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-8 text-center">
                <div>
                  <Users className="mx-auto text-zinc-500" size={44} />
                  <h3 className="mt-4 text-lg font-black text-white">Ainda nao ha clientes no painel</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Quando os pedidos chegarem, o historico por telefone aparece aqui automaticamente.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <p className="text-sm font-black text-white">Clientes frequentes</p>
                  <p className="mt-1 text-xs text-zinc-500">Ordenado por quantidade de pedidos.</p>
                  <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                    {clientProfiles.map((client) => (
                      <button
                        key={client.key}
                        type="button"
                        onClick={() => setSelectedClientPhone(client.key)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selectedClient?.key === client.key
                            ? "border-orange-300/60 bg-orange-400/[0.12]"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="truncate text-sm font-black text-white">{client.name}</strong>
                          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-orange-100">
                            {client.orders.length} pedidos
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{client.phone}</p>
                        <p className="mt-2 text-xs font-black text-orange-200">{formatCurrency(client.total)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedClient && (
                  <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Perfil do cliente</p>
                        <h3 className="mt-1 text-2xl font-black text-white">{selectedClient.name}</h3>
                        <p className="mt-1 text-sm text-zinc-400">{selectedClient.phone}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-right">
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-[10px] font-black uppercase text-zinc-500">Pedidos</p>
                          <strong className="text-lg font-black text-white">{selectedClient.orders.length}</strong>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-[10px] font-black uppercase text-zinc-500">Total</p>
                          <strong className="text-lg font-black text-orange-200">{formatCurrency(selectedClient.total)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                        <div className="flex items-center gap-2 text-sm font-black text-white">
                          <MapPin size={15} className="text-orange-300" />
                          Enderecos salvos
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedClient.addresses.length === 0 && (
                            <p className="text-sm font-bold text-zinc-500">Nenhum endereco salvo.</p>
                          )}
                          {selectedClient.addresses.map((address) => (
                            <p key={address} className="rounded-lg border border-white/10 bg-black/[0.18] p-3 text-sm text-zinc-200">
                              {address}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                        <div className="flex items-center gap-2 text-sm font-black text-white">
                          <MessageSquareText size={15} className="text-orange-300" />
                          Observacoes internas
                        </div>
                        <textarea
                          value={clientNotes[selectedClient.key] ?? ""}
                          onChange={(event) => updateClientNote(selectedClient.key, event.target.value)}
                          placeholder="Ex: sempre pede sem cebola, prefere troco, cliente frequente..."
                          className="mt-3 min-h-32 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-sm font-black text-white">Historico de pedidos</p>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {selectedClient.orders.map((order) => (
                          <div key={`${selectedClient.key}-${order.id}`} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/[0.18] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <strong className="text-sm font-black text-white">Pedido #{order.id}</strong>
                              <p className="mt-1 text-xs text-zinc-500">{order.time} | {order.delivery} | {order.payment}</p>
                            </div>
                            <span className="text-xs font-black text-orange-200">{formatCurrency(order.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!menuPanelOpen && !cashPanelOpen && !clientsPanelOpen && (
        <main className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[230px_minmax(0,1fr)_440px]">
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
                    setActiveStatusFilter("todos")
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
                setActiveStatusFilter("todos")
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
	                  onOpenDiscount={() => {
	                    setDiscountOrderId(order.id)
	                    setDiscountMode(order.discountPercent ? "percentual" : "valor")
	                    setDiscountValue(order.discountPercent ?? order.discount ?? 0)
	                    setDiscountReason(order.discountReason ?? "")
	                  }}
	                  onSelect={() => selectOrder(order)}
	                />
              ))}

	              {visibleOrders.length === 0 && (
	                <div className="rounded-lg border border-dashed border-white/[0.12] bg-black/[0.16] p-8 text-center">
	                  <PackageCheck className="mx-auto text-zinc-500" size={38} />
	                  <h3 className="mt-3 text-lg font-black text-white">
	                    {connectionStatus === "offline" ? "Backend offline" : "Nenhum pedido encontrado"}
	                  </h3>
	                  <p className="mt-2 text-sm leading-6 text-zinc-500">
	                    {connectionStatus === "offline"
	                      ? "O painel fica pronto com o cache local e atualiza assim que a API responder."
	                      : "Quando entrar um pedido novo, ele aparece aqui em ordem de horario."}
	                  </p>
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

                          {selectedOrder.status === "preparando" && (
                            <button
                              type="button"
                              onClick={() => updateSelectedOrder({ status: "saiu" }, `Pedido #${selectedOrder.id} marcado como pronto.`)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 text-xs font-black text-black transition hover:bg-cyan-300"
                            >
                              <CheckCircle2 size={15} />
                              Marcar pronto
                            </button>
                          )}

                          {selectedOrder.status === "saiu" && (
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
	                        <div className="flex items-center justify-between gap-3">
	                          <p className="text-[11px] font-black uppercase text-zinc-500">Itens do pedido</p>
	                          {isEditing && draft && (
	                            <button
	                              type="button"
	                              onClick={() => setDraft({ ...draft, items: [...draft.items, ""] })}
	                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-orange-300/25 bg-orange-400/10 px-2.5 text-[11px] font-black text-orange-100 transition hover:bg-orange-400/[0.18]"
	                            >
	                              <Plus size={13} />
	                              Item
	                            </button>
	                          )}
	                        </div>
	                        <div className="mt-2 space-y-2">
	                          {isEditing && draft ? (
	                            draft.items.map((item, index) => (
	                              <div key={`${index}-${item}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_36px]">
	                                <input
	                                  value={item}
	                                  onChange={(event) => {
	                                    const nextItems = [...draft.items]

	                                    nextItems[index] = event.target.value
	                                    setDraft({ ...draft, items: nextItems })
	                                  }}
	                                  placeholder="Ex: 1x X-Bacon + cheddar (sem cebola)"
	                                  className="h-10 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
	                                />
	                                <button
	                                  type="button"
	                                  onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}
	                                  className="grid h-10 place-items-center rounded-lg border border-red-300/25 bg-red-400/10 text-red-100 transition hover:bg-red-400/[0.18]"
	                                  aria-label="Remover item"
	                                >
	                                  <X size={14} />
	                                </button>
	                              </div>
	                            ))
	                          ) : (
	                            selectedOrder.items.map((item) => (
	                              <div key={item} className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white">
	                                {item}
	                              </div>
	                            ))
	                          )}
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
        )}
      </div>
    </MainLayout>
  )
}
