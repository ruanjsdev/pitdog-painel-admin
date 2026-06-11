import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  Edit3,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquareText,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Settings,
  Store,
  Tag,
  Truck,
  Upload,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react"

import { DashboardHeader } from "../components/dashboard/dashboard-header"
import { OrderFilters } from "../components/dashboard/order-filters"
import { OrderList } from "../components/dashboard/order-list"
import { OrderMetrics } from "../components/dashboard/order-metrics"
import { CashPanel, ClientsPanel, MenuAdminPanel, OrderDetails } from "../components/dashboard/panel-wrappers"
import { useLiveOrders } from "../hooks/use-live-orders"
import { useMenuAdmin } from "../hooks/use-menu-admin"
import {
  newOrderSoundModes,
  normalizeNewOrderSoundModeId,
  useNewOrderSound,
  type NewOrderSoundModeId,
} from "../hooks/use-new-order-sound"
import { MainLayout } from "../layouts/main-layout"
import {
  activeOrdersWindowHours,
  getActivePanelOrders,
  orderHistoryRetentionDays,
} from "../lib/order-sync"
import { printApprovalTickets } from "../services/print-service"
import {
  fetchWhatsAppBotStatus,
  fetchWhatsAppBotSettings,
  getWhatsAppAdminPin,
  getWhatsAppBotBaseUrl,
  notifyWhatsAppOrderStatus,
  saveWhatsAppBotConnectionSettings,
  saveWhatsAppBotSettings,
  sendWhatsAppTestMessage,
  type WhatsAppBotSettings,
  type WhatsAppBotStatus,
} from "../services/whatsapp-bot-api"
import { deliveryApi } from "../services/delivery-api"
import { flavorApi } from "../services/flavor-api"
import { addonsApi } from "../services/addons-api"
import type { DeliveryPerson, DeliveryPersonDraft } from "../types/delivery"
import type {
  MenuAdditional,
  MenuAdditionalDraft,
  MenuCategory,
  MenuCategoryDraft,
  MenuProduct,
  MenuProductDraft,
  ProductFlavor,
  ProductFlavorDraft,
} from "../types/menu"
import type { DeliveryType, Order } from "../types/order"

type DashboardProps = {
  onLogout: () => void
}

type OrderFilter = "todos" | "mesa" | "retirada" | "entrega"
type StatusFilter = "todos" | Order["status"]
type MenuPanelSection = "categorias" | "produtos" | "adicionais"
type CashTab = "todos" | "hamburgueres" | "cachorros" | "refrigerantes" | "adicionais" | "outros"
type MainPanel = "dashboard" | "pedidos" | "produtos" | "categorias" | "adicionais" | "sabores" | "motoboys" | "configuracoes" | "cardápio" | "caixa" | "clientes" | "zap"
type OrderDraft = Pick<Order, "customer" | "delivery" | "items" | "notes" | "payment" | "phone" | "total"> & {
  address: string
  changeFor: number
  complement: string
  courierId: string
  deliveryFee: number
  discount: number
  discountPercent: number
  discountReason: string
  needsChange: boolean
  neighborhood: string
  productCategoryToAddId: number
  productToAddId: number
  productToAddNote: string
  productToAddQuantity: number
  street: string
  subtotal: number
  tableNumber: string
}
type ErrorDialog = {
  message: string
  reason: string
  title: string
}
type StatusToast = {
  id: number
  message: string
}
type LocalPanelSettings = {
  autoPrint: boolean
  compactMode: boolean
  defaultDeliveryFee: number
  printCopies: number
}
type PrinterConfig = {
  autoPrintOnAccept: boolean
  enabled: boolean
  host: string
  port: number
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

const cancelReasons = [
  "Pedido duplicado",
  "Cancelado pelo cliente",
  "Item indisponível",
  "Endereço fora da área",
  "Pagamento não confirmado",
  "Pedido feito por engano",
]

const deliveryOptions: DeliveryType[] = ["Delivery", "Mesa", "Retirada"]
const paymentOptions = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito"]
const defaultDeliveryFee = 5
const couriersStorageKey = "pitsdog:admin:couriers:v1"
const flavorsStorageKey = "pitsdog:admin:flavors:v1"
const soundModeStorageKey = "pitsdog:admin:sound-mode:v1"
const pixSettingsStorageKey = "pitsdog:admin:pix-settings:v1"
const localPanelSettingsStorageKey = "pitsdog:admin:local-panel-settings:v1"

const emptyCategoryDraft: MenuCategoryDraft = {
  descricao: "",
  imagem: "",
  nome: "",
  ordem: 1,
  ativo: true,
}

const emptyProductDraft: MenuProductDraft = {
  addonIds: [],
  ativo: true,
  categoriaId: 0,
  descricao: "",
  flavorIds: [],
  flavorRequired: true,
  hasFlavors: false,
  highlight: "",
  imagem: "",
  maxFlavors: 1,
  nome: "",
  permiteAdicionais: false,
  preco: 0,
}

const emptyAdditionalDraft: MenuAdditionalDraft = {
  ativo: true,
  descricao: "",
  nome: "",
  preco: 0,
}

const emptyFlavorDraft: ProductFlavorDraft = {
  active: true,
  categoryId: "",
  name: "",
  notes: "",
  productId: "",
}

const emptyDeliveryPersonDraft: DeliveryPersonDraft = {
  active: true,
  name: "",
  notes: "",
  phone: "",
}

const defaultPrinterConfig: PrinterConfig = {
  autoPrintOnAccept: false,
  enabled: true,
  host: "192.168.3.17",
  port: 9100,
}

const deliveryHighlightStyles: Record<DeliveryType, string> = {
  Delivery: "border-orange-300/45 bg-orange-400/18 text-orange-100",
  Mesa: "border-cyan-300/45 bg-cyan-400/18 text-cyan-100",
  Retirada: "border-white/18 bg-white/10 text-white",
}

const deliveryIcons: Record<string, typeof Truck> = {
  Delivery: Truck,
  Mesa: Store,
  Retirada: PackageCheck,
}

function readCouriers() {
  try {
    return JSON.parse(window.localStorage.getItem(couriersStorageKey) ?? "[]") as DeliveryPerson[]
  } catch {
    return []
  }
}

function readFlavors() {
  try {
    return JSON.parse(window.localStorage.getItem(flavorsStorageKey) ?? "[]") as ProductFlavor[]
  } catch {
    return []
  }
}

function readSoundMode() {
  try {
    return normalizeNewOrderSoundModeId(window.localStorage.getItem(soundModeStorageKey))
  } catch {
    return "padrao" as NewOrderSoundModeId
  }
}

function readPixSettings() {
  const defaultPixSettings = {
    pixKey: "41172968000182",
    pixReceiverName: "Pedrinho francisco ferreira araujo - stone ip S.A.",
  }

  try {
    const settings = {
      ...defaultPixSettings,
      ...JSON.parse(window.localStorage.getItem(pixSettingsStorageKey) ?? "{}"),
    } as WhatsAppBotSettings

    return {
      ...settings,
      pixKey: settings.pixKey?.trim() || defaultPixSettings.pixKey,
      pixReceiverName: settings.pixReceiverName?.trim() || defaultPixSettings.pixReceiverName,
    }
  } catch {
    return defaultPixSettings
  }
}

function readLocalPanelSettings(): LocalPanelSettings {
  try {
    return {
      autoPrint: true,
      compactMode: false,
      defaultDeliveryFee,
      printCopies: 1,
      ...JSON.parse(window.localStorage.getItem(localPanelSettingsStorageKey) ?? "{}"),
    }
  } catch {
    return {
      autoPrint: true,
      compactMode: false,
      defaultDeliveryFee,
      printCopies: 1,
    }
  }
}

const cashTabLabels: Record<CashTab, string> = {
  adicionais: "Adicionais",
  cachorros: "Cachorros quentes",
  hamburgueres: "Hambúrgueres",
  outros: "Outros",
  refrigerantes: "Refrigerantes",
  todos: "Tudo que saiu",
}

function readWhatsAppConnectionSettings() {
  return {
    adminPin: getWhatsAppAdminPin(),
    botUrl: getWhatsAppBotBaseUrl(),
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value)
}

function numberInputValue(value: number) {
  return value === 0 ? "" : value
}

function readImageFile(event: ChangeEvent<HTMLInputElement>, onImageReady: (image: string) => void) {
  const file = event.target.files?.[0]

  if (!file) return

  const reader = new FileReader()

  reader.onload = () => {
    if (typeof reader.result === "string") {
      onImageReady(reader.result)
    }
  }

  reader.readAsDataURL(file)
  event.target.value = ""
}

function calculateDiscountAmount(subtotal: number, discount?: number, discountPercent?: number) {
  if (discountPercent && discountPercent > 0) {
    return subtotal * (discountPercent / 100)
  }

  return discount ?? 0
}

function calculateOrderTotal(order: Pick<Order, "deliveryFee" | "discount" | "discountPercent" | "subtotal" | "total">) {
  const subtotal = order.subtotal ?? order.total
  const discountAmount = calculateDiscountAmount(subtotal, order.discount, order.discountPercent)

  return Number(Math.max(0, subtotal + (order.deliveryFee ?? 0) - discountAmount).toFixed(2))
}

function calculateDraftTotal(draft: OrderDraft) {
  return calculateOrderTotal({
    deliveryFee: draft.delivery === "Delivery" ? draft.deliveryFee : 0,
    discount: draft.discount,
    discountPercent: draft.discountPercent,
    subtotal: draft.subtotal,
    total: draft.total,
  })
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getCurrentMonthRange(date = new Date()) {
  return {
    end: getLocalDateInputValue(date),
    start: getLocalDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1)),
  }
}

function getOrderDateInputValue(order: Order) {
  if (!order.createdAtTimestamp) return getLocalDateInputValue()

  return getLocalDateInputValue(new Date(order.createdAtTimestamp))
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "") || phone
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getPaymentBucket(payment: string) {
  const normalized = normalizeText(payment)

  if (normalized.includes("pix")) return "pix"
  if (normalized.includes("dinheiro")) return "dinheiro"
  if (normalized.includes("cart")) return "cartao"

  return "outros"
}

function isFinishedStatus(status: Order["status"]) {
  return status === "concluido" || status === "finalizado" || status === "cancelado"
}

function isMoneyReceived(order: Order) {
  return order.status !== "cancelado"
}

function getCashCategory(itemName: string): CashTab {
  const normalized = normalizeText(itemName)

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

function getCashCategoryFromMenu(
  itemName: string,
  productsByName: Map<string, MenuProduct>,
  categoriesById: Map<number, MenuCategory>
) {
  const product = productsByName.get(normalizeText(itemName))
  const categoryName = product ? categoriesById.get(product.categoriaId)?.nome ?? "" : ""

  if (!categoryName) return getCashCategory(itemName)

  const normalizedCategory = normalizeText(categoryName)

  if (normalizedCategory.includes("cachorro") || normalizedCategory.includes("hot dog")) return "cachorros"
  if (normalizedCategory.includes("burger") || normalizedCategory.includes("burguer") || normalizedCategory.includes("hamb")) return "hamburgueres"
  if (normalizedCategory.includes("adicional")) return "adicionais"
  if (normalizedCategory.includes("bebida") || normalizedCategory.includes("refri") || normalizedCategory.includes("suco")) return "refrigerantes"

  return getCashCategory(itemName)
}

function parseCashItems(
  rawItem: string,
  productsByName: Map<string, MenuProduct>,
  categoriesById: Map<number, MenuCategory>
) {
  const itemDetail = parseOrderItemDetail(rawItem)
  const items = [{
    category: getCashCategoryFromMenu(itemDetail.name, productsByName, categoriesById),
    name: itemDetail.name,
    quantity: itemDetail.quantity,
  }]

  itemDetail.additions.forEach((additionGroup) => {
    additionGroup.split(",").map((addition) => addition.trim()).filter(Boolean).forEach((addition) => {
      items.push({
        category: "adicionais",
        name: addition,
        quantity: itemDetail.quantity,
      })
    })
  })

  return items
}

function parseOrderItemDetail(rawItem: string) {
  const quantityMatch = rawItem.match(/^(\d+)\s*x\s*/i)
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1
  const withoutQuantity = rawItem.replace(/^(\d+)\s*x\s*/i, "").trim()
  const noteMatch = withoutQuantity.match(/\(([^()]*)\)\s*$/)
  const note = noteMatch?.[1]?.trim() ?? ""
  const withoutNote = note ? withoutQuantity.replace(/\s*\([^()]*\)\s*$/, "").trim() : withoutQuantity
  const [name = rawItem, ...additionParts] = withoutNote.split(" + ")

  return {
    additions: additionParts.map((addition) => addition.trim()).filter(Boolean),
    name: name.trim() || rawItem,
    note,
    quantity,
  }
}

function formatDraftAddress(draft: OrderDraft) {
  if (draft.delivery === "Mesa") {
    return `Mesa ${draft.tableNumber || draft.address || "-"}`
  }

  if (draft.delivery === "Retirada") {
    return draft.address || "Retirada no balcão"
  }

  return [
    draft.street || draft.address,
    draft.neighborhood,
    draft.complement,
  ].filter(Boolean).join(", ")
}

function matchesFilter(order: Order, filter: OrderFilter) {
  if (filter === "todos") return true
  if (filter === "entrega") return order.delivery === "Delivery"
  if (filter === "retirada") return order.delivery === "Retirada"
  return order.delivery === "Mesa"
}

function isErrorNotice(message: string) {
  const normalized = normalizeText(message)

  return (
    normalized.includes("nao foi possivel") ||
    normalized.includes("erro") ||
    normalized.includes("falhou") ||
    normalized.includes("invalido") ||
    normalized.includes("informe") ||
    normalized.includes("conecte") ||
    normalized.includes("necessario") ||
    normalized.includes("pendencia") ||
    normalized.includes("aguardando backend")
  )
}

function getErrorReason(message: string) {
  const normalized = normalizeText(message)

  if (normalized.includes("api") || normalized.includes("backend") || normalized.includes("sinal")) {
    return "A comunicação com o sistema principal não respondeu agora. Confira se a API/backend está online e tente novamente."
  }

  if (normalized.includes("informe") || normalized.includes("necessario") || normalized.includes("invalido")) {
    return "Alguma informação obrigatória está faltando ou inválida. Revise os campos destacados e tente de novo."
  }

  if (normalized.includes("pendencia")) {
    return "Existe uma alteração pendente de sincronização. Quando a conexão voltar, tente reenviar ou repita a ação."
  }

  return "O painel encontrou uma situação que precisa da sua atenção antes de continuar."
}

function getShortStatusMessage(changes: Partial<Order>, fallbackMessage: string) {
  if (changes.status === "aprovado") return "Pedido aprovado"
  if (changes.status === "preparando") return "Pedido aprovado e em preparo"
  if (changes.status === "pronto") return "Pedido pronto"
  if (changes.status === "saiu") return "Saiu para entrega"
  if (changes.status === "concluido") return "Pedido concluído"
  if (changes.status === "finalizado") return "Pedido finalizado"
  if (changes.status === "cancelado") return "Pedido cancelado"

  return fallbackMessage
}

function getWhatsAppEventForOrderStatus(status?: Order["status"]) {
  if (status === "aprovado") return "pedido_aprovado"
  if (status === "preparando") return "pedido_aprovado"
  if (status === "pronto") return "pronto"
  if (status === "saiu") return "saiu_entrega"
  if (status === "concluido") return "finalizado"
  if (status === "finalizado") return "finalizado"
  if (status === "cancelado") return "cancelado"

  return null
}

export function Dashboard({ onLogout }: DashboardProps) {
  const {
    connectionStatus,
    isSyncing,
    orderList,
    applyOrderChanges,
    restoreOrder,
    updateOrder,
    updateStoreStatus,
  } = useLiveOrders()
  const menuAdmin = useMenuAdmin()

  // Limpa o cache local de menu ao montar o componente para remover dados "sujos"
  useEffect(() => {
    window.localStorage.removeItem("pitsdog:admin:menu:v1")
  }, [])

  const [selectedOrderId, setSelectedOrderId] = useState<number>()
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("todos")
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("todos")
  const [search, setSearch] = useState("")
  const [hideFinished, setHideFinished] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [storeOpen, setStoreOpen] = useState(true)
  const [notice, setNotice] = useState(
    `Painel de gestão: pedidos ativos por ${activeOrdersWindowHours}h e histórico por ${orderHistoryRetentionDays} dias.`
  )
  const [errorDialog, setErrorDialog] = useState<ErrorDialog | null>(null)
  const [statusToast, setStatusToast] = useState<StatusToast | null>(null)
  const [actionOverlayLabel, setActionOverlayLabel] = useState("")
  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelReason, setCancelReason] = useState(cancelReasons[0])
  const [categoryDraft, setCategoryDraft] = useState<MenuCategoryDraft>(emptyCategoryDraft)
  const [categoryFeedback, setCategoryFeedback] = useState("")
  const [categorySaving, setCategorySaving] = useState(false)
  const [productDraft, setProductDraft] = useState<MenuProductDraft>(emptyProductDraft)
  const [productSaving, setProductSaving] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [productCategoryFilter, setProductCategoryFilter] = useState(0)
  const [additionalDraft, setAdditionalDraft] = useState<MenuAdditionalDraft>(emptyAdditionalDraft)
  const [additionalSaving, setAdditionalSaving] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editingAdditionalId, setEditingAdditionalId] = useState<number | null>(null)
  const [menuPanelSection, setMenuPanelSection] = useState<MenuPanelSection>("categorias")
  const [menuPanelOpen, setMenuPanelOpen] = useState(false)
  const [cashPanelOpen, setCashPanelOpen] = useState(false)
  const [clientsPanelOpen, setClientsPanelOpen] = useState(false)
  const [zapPanelOpen, setZapPanelOpen] = useState(false)
  const [deliveryPeoplePanelOpen, setDeliveryPeoplePanelOpen] = useState(false)
  const [flavorsPanelOpen, setFlavorsPanelOpen] = useState(false)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [ordersView, setOrdersView] = useState<"dashboard" | "pedidos">("dashboard")
  const [flavorSearch, setFlavorSearch] = useState("")
  const [deliveryPersonSearch, setDeliveryPersonSearch] = useState("")
  const [cashTab, setCashTab] = useState<CashTab>("todos")
  const [reportStartDate, setReportStartDate] = useState(getLocalDateInputValue())
  const [reportEndDate, setReportEndDate] = useState(getLocalDateInputValue())
  const [selectedClientPhone, setSelectedClientPhone] = useState("")
  const [whatsAppBotStatus, setWhatsAppBotStatus] = useState<WhatsAppBotStatus | null>(null)
  const [whatsAppBotLoading, setWhatsAppBotLoading] = useState(false)
  const [whatsAppBotError, setWhatsAppBotError] = useState("")
  const [whatsAppConnectionSettings, setWhatsAppConnectionSettings] = useState(readWhatsAppConnectionSettings)
  const [whatsAppTestPhone, setWhatsAppTestPhone] = useState("")
  const [whatsAppTestSending, setWhatsAppTestSending] = useState(false)
  const [pixSettings, setPixSettings] = useState<WhatsAppBotSettings>(readPixSettings)
  const [pixSettingsSaving, setPixSettingsSaving] = useState(false)
  const [pixSettingsFeedback, setPixSettingsFeedback] = useState("")
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<number>>(() => new Set())
  const updatingOrderIdsRef = useRef(new Set<number>())
  const [couriers, setCouriers] = useState<DeliveryPerson[]>(readCouriers)
  const [courierDraft, setCourierDraft] = useState<DeliveryPersonDraft>(emptyDeliveryPersonDraft)
  const [editingCourierId, setEditingCourierId] = useState<string | null>(null)
  const [courierFeedback, setCourierFeedback] = useState("")
  const [courierSaving, setCourierSaving] = useState(false)
  const [flavors, setFlavors] = useState<ProductFlavor[]>(readFlavors)
  const [flavorDraft, setFlavorDraft] = useState<ProductFlavorDraft>(emptyFlavorDraft)
  const [editingFlavorId, setEditingFlavorId] = useState<string | null>(null)
  const [flavorFeedback, setFlavorFeedback] = useState("")
  const [flavorSaving, setFlavorSaving] = useState(false)
  const [addonModalProduct, setAddonModalProduct] = useState<MenuProduct | null>(null)
  const [addonModalSearch, setAddonModalSearch] = useState("")
  const [addonModalSelectedIds, setAddonModalSelectedIds] = useState<string[]>([])
  const [addonModalInitialIds, setAddonModalInitialIds] = useState<string[]>([])
  const [addonModalFeedback, setAddonModalFeedback] = useState("")
  const [addonModalSaving, setAddonModalSaving] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(defaultPrinterConfig)
  const [printerFeedback, setPrinterFeedback] = useState("")
  const [printerLoading, setPrinterLoading] = useState(false)
  const [clientNotes, setClientNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("pitsdog:admin:client-notes:v1") ?? "{}") as Record<string, string>
    } catch {
      return {}
    }
  })
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundModeId, setSoundModeId] = useState<NewOrderSoundModeId>(readSoundMode)
  const [localPanelSettings, setLocalPanelSettings] = useState<LocalPanelSettings>(readLocalPanelSettings)
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [activePanelClock, setActivePanelClock] = useState(() => Date.now())
  const [syncClock, setSyncClock] = useState(() => (
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  ))
  const activeOrderList = useMemo(
    () => getActivePanelOrders(orderList, activePanelClock),
    [activePanelClock, orderList]
  )
  const orderSound = useNewOrderSound(activeOrderList, { enabled: soundEnabled, soundModeId })

  const activeSelectedOrderId = selectedOrderId ?? activeOrderList[0]?.id
  const selectedOrder = activeOrderList.find((order) => order.id === activeSelectedOrderId)
  const selectedOrderStorageId = selectedOrder ? selectedOrder.backendId ?? selectedOrder.id : undefined
  const selectedOrderIsUpdating = selectedOrderStorageId ? updatingOrderIds.has(selectedOrderStorageId) : false

  function showNotice(message: string) {
    if (isErrorNotice(message)) {
      setErrorDialog({
        message,
        reason: getErrorReason(message),
        title: "Atenção no painel",
      })
      return
    }

    setNotice(message)
  }

  function showStatusToast(message: string, durationMs = 6500) {
    const toastId = Date.now()

    setStatusToast({
      id: toastId,
      message,
    })

    window.setTimeout(() => {
      setStatusToast((currentToast) => (
        currentToast?.id === toastId ? null : currentToast
      ))
    }, durationMs)
  }

  async function refreshWhatsAppBotStatus(showSuccessNotice = false) {
    setWhatsAppBotLoading(true)
    setWhatsAppBotError("")

    try {
      const status = await fetchWhatsAppBotStatus()

      setWhatsAppBotStatus(status)

      if (showSuccessNotice) {
        showStatusToast(status.connected ? "WhatsApp conectado" : "Status do Zap atualizado")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível conectar ao bot WhatsApp."

      setWhatsAppBotError(message)

      if (showSuccessNotice) {
        showNotice(message)
      }
    } finally {
      setWhatsAppBotLoading(false)
    }
  }

  async function refreshPixSettings() {
    try {
      const settings = await fetchWhatsAppBotSettings()

      setPixSettings(settings)
      window.localStorage.setItem(pixSettingsStorageKey, JSON.stringify(settings))
      setPixSettingsFeedback("")
    } catch (error) {
      setPixSettingsFeedback(error instanceof Error ? error.message : "Não foi possível carregar a chave PIX do bot.")
    }
  }

  function saveWhatsAppConnectionSettings() {
    const botUrl = whatsAppConnectionSettings.botUrl.trim().replace(/\/$/, "")

    if (!botUrl) {
      setWhatsAppBotError("Informe a URL do bot WhatsApp no Render.")
      return
    }

    saveWhatsAppBotConnectionSettings({
      adminPin: whatsAppConnectionSettings.adminPin,
      botUrl,
    })
    setWhatsAppConnectionSettings({
      ...whatsAppConnectionSettings,
      botUrl,
    })
    setWhatsAppBotStatus(null)
    setWhatsAppBotError("")
    showStatusToast("URL do bot salva")
    void refreshWhatsAppBotStatus(true)
  }

  async function savePixSettings() {
    setPixSettingsSaving(true)
    setPixSettingsFeedback("")

    try {
      const settings = await saveWhatsAppBotSettings(pixSettings)

      setPixSettings(settings)
      window.localStorage.setItem(pixSettingsStorageKey, JSON.stringify(settings))
      setPixSettingsFeedback("Chave PIX salva no bot.")
      showStatusToast("PIX salvo")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a chave PIX."

      window.localStorage.setItem(pixSettingsStorageKey, JSON.stringify(pixSettings))
      setPixSettingsFeedback(`${message} Uma cópia ficou salva neste painel.`)
      showNotice(message)
    } finally {
      setPixSettingsSaving(false)
    }
  }

  async function testWhatsAppMessage() {
    setWhatsAppTestSending(true)
    setWhatsAppBotError("")

    try {
      await sendWhatsAppTestMessage(whatsAppTestPhone)
      showStatusToast("Teste enviado no WhatsApp")
      void refreshWhatsAppBotStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a mensagem de teste."

      setWhatsAppBotError(message)
      showNotice(message)
    } finally {
      setWhatsAppTestSending(false)
    }
  }

  useEffect(() => {
    function handleRuntimeError(event: ErrorEvent) {
      setErrorDialog({
        message: event.message || "Erro inesperado no painel.",
        reason: "O navegador identificou uma falha inesperada na tela. Clique em continuar e tente repetir a ação.",
        title: "Erro inesperado",
      })
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === "string"
          ? event.reason
          : "Erro inesperado no painel."

      setErrorDialog({
        message: reason,
        reason: "Uma ação assíncrona não conseguiu finalizar. Isso costuma acontecer quando a API está offline ou demorou para responder.",
        title: "Erro inesperado",
      })
    }

    window.addEventListener("error", handleRuntimeError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleRuntimeError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(couriersStorageKey, JSON.stringify(couriers))
  }, [couriers])

  useEffect(() => {
    window.localStorage.setItem(flavorsStorageKey, JSON.stringify(flavors))
  }, [flavors])

  useEffect(() => {
    deliveryApi.listDeliveryPeople()
      .then((deliveryPeople) => {
        if (deliveryPeople && deliveryPeople.length > 0) {
          setCouriers(deliveryPeople)
          setCourierFeedback("")
        }
      })
      .catch((error) => {
        setCourierFeedback(error instanceof Error ? error.message : "Recurso ainda não disponível na API.")
      })

    flavorApi.listFlavors()
      .then((loadedFlavors) => {
        if (loadedFlavors && loadedFlavors.length > 0) {
          setFlavors(loadedFlavors)
          setFlavorFeedback("")
        }
      })
      .catch((error) => {
        setFlavorFeedback(error instanceof Error ? error.message : "Recurso ainda não disponível na API.")
      })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(soundModeStorageKey, soundModeId)
  }, [soundModeId])

  useEffect(() => {
    window.localStorage.setItem(localPanelSettingsStorageKey, JSON.stringify(localPanelSettings))
  }, [localPanelSettings])

  useEffect(() => {
    if (!window.pitsDog?.printer?.getConfig) {
      setPrinterFeedback("Impressão direta disponível apenas no app desktop.")
      return
    }

    setPrinterLoading(true)
    window.pitsDog.printer.getConfig()
      .then((result) => {
        if (!result.ok || !result.data) {
          setPrinterFeedback(result.error || "Não foi possível carregar a impressora.")
          return
        }

        setPrinterConfig(result.data)
        setLocalPanelSettings((settings) => ({
          ...settings,
          autoPrint: result.data?.autoPrintOnAccept ?? settings.autoPrint,
        }))
        setPrinterFeedback("")
      })
      .finally(() => setPrinterLoading(false))
  }, [])

  useEffect(() => {
    void refreshPixSettings()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePanelClock(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSyncClock(new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedOrderId) return
    if (activeOrderList.some((order) => order.id === selectedOrderId)) return

    setSelectedOrderId(undefined)
  }, [activeOrderList, selectedOrderId])

  useEffect(() => {
    if (!zapPanelOpen) return

    void refreshWhatsAppBotStatus()

    const timer = window.setInterval(() => {
      void refreshWhatsAppBotStatus()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [zapPanelOpen])

  const counts = useMemo(() => {
    const countByDelivery = (delivery: string) =>
      activeOrderList.filter((order) => order.delivery === delivery && order.status !== "cancelado").length

    return {
      all: activeOrderList.length,
      mesa: countByDelivery("Mesa"),
      retirada: countByDelivery("Retirada"),
      entrega: countByDelivery("Delivery"),
      novo: activeOrderList.filter((order) => order.status === "novo").length,
      aprovado: activeOrderList.filter((order) => order.status === "aprovado").length,
      preparando: activeOrderList.filter((order) => order.status === "preparando").length,
      pronto: activeOrderList.filter((order) => order.status === "pronto").length,
      saiu: activeOrderList.filter((order) => order.status === "saiu").length,
      cancelado: activeOrderList.filter((order) => order.status === "cancelado").length,
      concluido: activeOrderList.filter((order) => order.status === "concluido").length,
      finalizado: activeOrderList.filter((order) => order.status === "finalizado").length,
    }
  }, [activeOrderList])

  const metrics = [
    {
      label: "Aguardando aprovação",
      value: String(counts.novo),
      detail: "novos pedidos",
      icon: Clock3,
      status: "novo" as StatusFilter,
    },
    {
      label: "Atualizado",
      value: "0",
      detail: "sem pendências",
      icon: CheckCircle2,
      status: "todos" as StatusFilter,
    },
    {
      label: "Em preparação",
      value: String(counts.aprovado + counts.preparando),
      detail: "na cozinha",
      icon: PackageCheck,
      status: "preparando" as StatusFilter,
    },
    {
      label: "Pronto",
      value: String(counts.pronto + counts.saiu),
      detail: "aguardando saída",
      icon: Truck,
      status: "pronto" as StatusFilter,
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
      label: "Finalizado",
      value: String(counts.finalizado),
      detail: "pedidos encerrados",
      icon: CheckCircle2,
      status: "finalizado" as StatusFilter,
    },
  ]

  const visibleOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return activeOrderList.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        order.customer.toLowerCase().includes(normalizedSearch) ||
        String(order.id).includes(normalizedSearch)

      const matchesFinished = !hideFinished || !isFinishedStatus(order.status)
      const matchesStatus = activeStatusFilter === "todos" || order.status === activeStatusFilter

      return matchesFilter(order, activeFilter) && matchesSearch && matchesFinished && matchesStatus
    })
  }, [activeFilter, activeOrderList, activeStatusFilter, hideFinished, search])
  const visibleOrdersWithTotals = visibleOrders.map((order) => ({
    ...order,
    total: calculateOrderTotal(order),
  }))

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
  }, [menuAdmin.categories, menuAdmin.products, productCategoryFilter, productSearch])

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
  const normalizedReportStartDate = reportStartDate <= reportEndDate ? reportStartDate : reportEndDate
  const normalizedReportEndDate = reportStartDate <= reportEndDate ? reportEndDate : reportStartDate
  const reportPeriodLabel = normalizedReportStartDate === normalizedReportEndDate
    ? normalizedReportStartDate
    : `${normalizedReportStartDate} até ${normalizedReportEndDate}`
  const reportOrders = useMemo(
    () => cashOrders.filter((order) => {
      const orderDate = getOrderDateInputValue(order)

      return orderDate >= normalizedReportStartDate && orderDate <= normalizedReportEndDate
    }),
    [cashOrders, normalizedReportEndDate, normalizedReportStartDate]
  )
  const cashItems = useMemo(() => {
    const itemMap = new Map<string, { category: CashTab; name: string; quantity: number }>()
    const productsByName = new Map(
      menuAdmin.products.map((product) => [normalizeText(product.nome), product])
    )
    const categoriesById = new Map(menuAdmin.categories.map((category) => [category.id, category]))

    reportOrders.forEach((order) => {
      order.items.forEach((rawItem) => {
        parseCashItems(rawItem, productsByName, categoriesById).forEach((item) => {
          const key = `${item.category}:${normalizeText(item.name)}`
          const currentItem = itemMap.get(key)

          if (currentItem) {
            itemMap.set(key, {
              ...currentItem,
              quantity: currentItem.quantity + item.quantity,
            })
            return
          }

          itemMap.set(key, item)
        })
      })
    })

    return [...itemMap.values()].sort((first, second) => second.quantity - first.quantity)
  }, [menuAdmin.categories, menuAdmin.products, reportOrders])
  const visibleCashItems = cashTab === "todos"
    ? cashItems
    : cashItems.filter((item) => item.category === cashTab)
  const activeCouriers = couriers.filter((courier) => courier.active)
  const visibleDeliveryPeople = couriers.filter((courier) => {
    const normalizedSearch = normalizeText(deliveryPersonSearch.trim())

    return !normalizedSearch ||
      normalizeText(`${courier.name} ${courier.phone ?? ""}`).includes(normalizedSearch)
  })
  const activeFlavors = flavors.filter((flavor) => flavor.active)
  const visibleFlavors = flavors.filter((flavor) => {
    const normalizedSearch = normalizeText(flavorSearch.trim())

    return !normalizedSearch ||
      normalizeText(`${flavor.name} ${flavor.notes ?? ""}`).includes(normalizedSearch)
  })
  const reportDeliveryOrders = reportOrders.filter((order) => order.delivery === "Delivery" && order.status !== "cancelado")
  const courierStats = couriers.map((courier) => ({
    ...courier,
    ordersCount: reportOrders.filter((order) => order.courierId === courier.id).length,
  }))
  const activeMenuCategories = menuAdmin.categories.filter((category) => category.ativo)
  const draftProductsInCategory = menuAdmin.products.filter((product) => {
    if (!product.ativo) return false
    if (!draft?.productCategoryToAddId) return true

    return product.categoriaId === draft.productCategoryToAddId
  })
  const completedRevenue = reportOrders
    .filter(isMoneyReceived)
    .reduce((total, order) => total + calculateOrderTotal(order), 0)
  const openRevenue = reportOrders
    .filter((order) => order.status !== "cancelado" && !isMoneyReceived(order))
    .reduce((total, order) => total + calculateOrderTotal(order), 0)
  const completedOrdersCount = reportOrders.filter(isMoneyReceived).length
  const averageTicket = completedOrdersCount ? completedRevenue / completedOrdersCount : 0
  const paymentSummary = useMemo(() => {
    const summary = { cartao: 0, dinheiro: 0, outros: 0, pix: 0 }

    reportOrders
      .filter(isMoneyReceived)
      .forEach((order) => {
        summary[getPaymentBucket(order.payment)] += calculateOrderTotal(order)
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
      currentClient.total += order.status === "cancelado" ? 0 : calculateOrderTotal(order)
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
    orderSound.acknowledgeOrder(order)
    setSelectedOrderId(order.id)
    setIsEditing(false)
    setIsCanceling(false)
    setDraft(null)
    showNotice(`Pedido #${order.id} selecionado.`)
  }

  function updateClientNote(clientKey: string, note: string) {
    const nextNotes = { ...clientNotes, [clientKey]: note }

    setClientNotes(nextNotes)
    window.localStorage.setItem("pitsdog:admin:client-notes:v1", JSON.stringify(nextNotes))
  }

  async function addCourier() {
    const name = courierDraft.name.trim()

    if (!name) {
      showNotice("Informe o nome do motoboy para cadastrar.")
      return
    }

    setCourierSaving(true)
    setCourierFeedback("")

    if (editingCourierId) {
      const previousCouriers = couriers
      const nextDraft = { ...courierDraft, name }

      setCouriers((currentCouriers) => currentCouriers.map((courier) => (
        courier.id === editingCourierId ? { ...courier, ...nextDraft } : courier
      )))

      try {
        await deliveryApi.updateDeliveryPerson(editingCourierId, nextDraft)
        setCourierFeedback(`${name} atualizado na API.`)
      } catch (error) {
        setCourierFeedback(error instanceof Error ? `${error.message} Alteração mantida localmente.` : "Alteração mantida localmente.")
        setCouriers(previousCouriers.map((courier) => (
          courier.id === editingCourierId ? { ...courier, ...nextDraft } : courier
        )))
      } finally {
        setCourierDraft(emptyDeliveryPersonDraft)
        setEditingCourierId(null)
        setCourierSaving(false)
      }

      showNotice(`${name} atualizado no cadastro de entregadores.`)
      return
    }

    const localCourier = {
      ...courierDraft,
      id: `motoboy-${Date.now()}`,
      name,
    }

    setCouriers((currentCouriers) => [...currentCouriers, localCourier])

    try {
      const createdCourier = await deliveryApi.createDeliveryPerson({ ...courierDraft, name })

      if (createdCourier) {
        setCouriers((currentCouriers) => currentCouriers.map((courier) => (
          courier.id === localCourier.id ? createdCourier : courier
        )))
      }
      setCourierFeedback(`${name} cadastrado na API.`)
    } catch (error) {
      setCourierFeedback(error instanceof Error ? `${error.message} Cadastro mantido localmente.` : "Cadastro mantido localmente.")
    } finally {
      setCourierDraft(emptyDeliveryPersonDraft)
      setCourierSaving(false)
    }

    showNotice(`${name} cadastrado como entregador.`)
  }

  function editCourier(courier: DeliveryPerson) {
    setCourierDraft({
      active: courier.active,
      name: courier.name,
      notes: courier.notes ?? "",
      phone: courier.phone ?? "",
    })
    setEditingCourierId(courier.id)
    showNotice(`Editando entregador ${courier.name}.`)
  }

  async function toggleCourierStatus(courier: DeliveryPerson) {
    const nextCourier = { ...courier, active: !courier.active }

    setCouriers((currentCouriers) => currentCouriers.map((currentCourier) => (
      currentCourier.id === courier.id ? nextCourier : currentCourier
    )))

    try {
      await deliveryApi.updateDeliveryPerson(courier.id, {
        active: nextCourier.active,
        name: nextCourier.name,
        notes: nextCourier.notes,
        phone: nextCourier.phone,
      })
      setCourierFeedback(nextCourier.active ? "Entregador ativado na API." : "Entregador inativado na API.")
    } catch (error) {
      setCourierFeedback(error instanceof Error ? `${error.message} Status mantido localmente.` : "Status mantido localmente.")
    }
  }

  async function deleteCourier(courier: DeliveryPerson) {
    if (!window.confirm(`Excluir ${courier.name}?`)) return

    const previousCouriers = couriers

    setCouriers((currentCouriers) => currentCouriers.filter((currentCourier) => currentCourier.id !== courier.id))

    try {
      await deliveryApi.deleteDeliveryPerson(courier.id)
      setCourierFeedback(`${courier.name} excluído na API.`)
    } catch (error) {
      setCourierFeedback(error instanceof Error ? `${error.message} Remoção feita apenas neste painel.` : "Remoção feita apenas neste painel.")
      if (error instanceof Error && !error.message.includes("Recurso ainda não disponível")) {
        setCouriers(previousCouriers)
      }
    }
  }

  async function assignCourierToOrder(order: Order, courierId: string) {
    const selectedCourier = couriers.find((courier) => courier.id === courierId)
    const orderId = order.backendId ?? order.id
    const previousOrder = order
    const changes = {
      courierId: courierId || undefined,
      courierName: selectedCourier?.name,
    }

    applyOrderChanges(orderId, changes)
    try {
      const updated = await updateOrder(orderId, changes, courierId
        ? `Motoboy ${selectedCourier?.name ?? ""} vinculado ao pedido #${order.id}.`
        : `Motoboy removido do pedido #${order.id}.`
      )

      if (!updated) {
        applyOrderChanges(orderId, previousOrder)
        showNotice("Não foi possível salvar o motoboy na API agora.")
        return
      }

      showStatusToast(courierId ? "Motoboy selecionado" : "Motoboy removido")
    } catch (error) {
      applyOrderChanges(orderId, previousOrder)
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar o motoboy na API agora.")
    }
  }

  async function saveFlavor() {
    const name = flavorDraft.name.trim()

    if (!name) {
      showNotice("Informe o nome do sabor.")
      return
    }

    setFlavorSaving(true)
    setFlavorFeedback("")

    if (editingFlavorId) {
      const nextDraft = { ...flavorDraft, name }

      setFlavors((currentFlavors) => currentFlavors.map((flavor) => (
        flavor.id === editingFlavorId ? { ...flavor, ...nextDraft } : flavor
      )))

      try {
        await flavorApi.updateFlavor(editingFlavorId, nextDraft)
        setFlavorFeedback(`${name} atualizado na API.`)
      } catch (error) {
        setFlavorFeedback(error instanceof Error ? `${error.message} Alteração mantida localmente.` : "Alteração mantida localmente.")
      } finally {
        setFlavorDraft(emptyFlavorDraft)
        setEditingFlavorId(null)
        setFlavorSaving(false)
      }

      showNotice(`${name} atualizado em sabores.`)
      return
    }

    const localFlavor = {
      ...flavorDraft,
      id: `flavor-${Date.now()}`,
      name,
    }

    setFlavors((currentFlavors) => [...currentFlavors, localFlavor])

    try {
      const createdFlavor = await flavorApi.createFlavor({ ...flavorDraft, name })

      if (createdFlavor) {
        setFlavors((currentFlavors) => currentFlavors.map((flavor) => (
          flavor.id === localFlavor.id ? createdFlavor : flavor
        )))
      }
      setFlavorFeedback(`${name} cadastrado na API.`)
    } catch (error) {
      setFlavorFeedback(error instanceof Error ? `${error.message} Cadastro mantido localmente.` : "Cadastro mantido localmente.")
    } finally {
      setFlavorDraft(emptyFlavorDraft)
      setFlavorSaving(false)
    }

    showNotice(`${name} cadastrado como sabor.`)
  }

  function editFlavor(flavor: ProductFlavor) {
    setFlavorDraft({
      active: flavor.active,
      categoryId: flavor.categoryId ?? "",
      name: flavor.name,
      notes: flavor.notes ?? "",
      productId: flavor.productId ?? "",
    })
    setEditingFlavorId(flavor.id)
    showNotice(`Editando sabor ${flavor.name}.`)
  }

  async function toggleFlavorStatus(flavor: ProductFlavor) {
    const nextFlavor = { ...flavor, active: !flavor.active }

    setFlavors((currentFlavors) => currentFlavors.map((currentFlavor) => (
      currentFlavor.id === flavor.id ? nextFlavor : currentFlavor
    )))

    try {
      await flavorApi.updateFlavor(flavor.id, {
        active: nextFlavor.active,
        categoryId: nextFlavor.categoryId,
        name: nextFlavor.name,
        notes: nextFlavor.notes,
        productId: nextFlavor.productId,
      })
      setFlavorFeedback(nextFlavor.active ? "Sabor ativado na API." : "Sabor inativado na API.")
    } catch (error) {
      setFlavorFeedback(error instanceof Error ? `${error.message} Status mantido localmente.` : "Status mantido localmente.")
    }
  }

  async function deleteFlavor(flavor: ProductFlavor) {
    if (!window.confirm(`Excluir sabor ${flavor.name}?`)) return

    const previousFlavors = flavors

    setFlavors((currentFlavors) => currentFlavors.filter((currentFlavor) => currentFlavor.id !== flavor.id))

    try {
      await flavorApi.deleteFlavor(flavor.id)
      setFlavorFeedback(`${flavor.name} excluído na API.`)
    } catch (error) {
      setFlavorFeedback(error instanceof Error ? `${error.message} Remoção feita apenas neste painel.` : "Remoção feita apenas neste painel.")
      if (error instanceof Error && !error.message.includes("Recurso ainda não disponível")) {
        setFlavors(previousFlavors)
      }
    }
  }

  async function savePrinterSettings() {
    if (!window.pitsDog?.printer?.saveConfig) {
      setPrinterFeedback("Essa função só está disponível no app desktop.")
      return
    }

    setPrinterLoading(true)
    setPrinterFeedback("")

    const nextConfig = {
      ...printerConfig,
      autoPrintOnAccept: localPanelSettings.autoPrint,
    }

    try {
      const result = await window.pitsDog.printer.saveConfig(nextConfig)

      if (!result.ok || !result.data) {
        setPrinterFeedback(result.error || "Não foi possível salvar as configurações.")
        return
      }

      setPrinterConfig(result.data)
      setLocalPanelSettings((settings) => ({
        ...settings,
        autoPrint: result.data?.autoPrintOnAccept ?? settings.autoPrint,
      }))
      setPrinterFeedback(result.message || "Configurações salvas com sucesso.")
    } finally {
      setPrinterLoading(false)
    }
  }

  async function checkPrinterConnection() {
    if (!window.pitsDog?.printer?.checkConnection) {
      setPrinterFeedback("Essa função só está disponível no app desktop.")
      return
    }

    setPrinterLoading(true)
    setPrinterFeedback("")

    try {
      await window.pitsDog.printer.saveConfig({
        ...printerConfig,
        autoPrintOnAccept: localPanelSettings.autoPrint,
      })
      const result = await window.pitsDog.printer.checkConnection()

      setPrinterFeedback(result.ok ? result.message || "Conexão com a impressora confirmada." : result.error || "Não foi possível conectar na impressora.")
    } finally {
      setPrinterLoading(false)
    }
  }

  async function testPrinter() {
    if (!window.pitsDog?.printer?.testPrint) {
      setPrinterFeedback("Essa função só está disponível no app desktop.")
      return
    }

    setPrinterLoading(true)
    setPrinterFeedback("")

    try {
      await window.pitsDog.printer.saveConfig({
        ...printerConfig,
        autoPrintOnAccept: localPanelSettings.autoPrint,
      })
      const result = await window.pitsDog.printer.testPrint()

      setPrinterFeedback(result.ok ? result.message || "Impressão de teste enviada." : result.error || "Não foi possível conectar na impressora.")
    } finally {
      setPrinterLoading(false)
    }
  }

  function updateDraftDelivery(delivery: DeliveryType) {
    if (!draft) return
    const deliveryFee = delivery === "Delivery" ? draft.deliveryFee || localPanelSettings.defaultDeliveryFee : 0

    const nextDraft = {
      ...draft,
      courierId: delivery === "Delivery" ? draft.courierId : "",
      delivery,
      deliveryFee,
    }

    setDraft({
      ...nextDraft,
      total: calculateDraftTotal(nextDraft),
    })
  }

  function exportDailyReport() {
    const rows = [
      ["Período", reportPeriodLabel],
      [],
      ["Pedido", "Cliente", "Telefone", "Status", "Entrega", "Motoboy", "Pagamento", "Total", "Horário"],
      ...reportOrders.map((order) => [
        `#${order.id}`,
        order.customer,
        order.phone,
        statusLabels[order.status] ?? order.status,
        order.delivery,
        order.courierName ?? "",
        order.payment,
        String(calculateOrderTotal(order)).replace(".", ","),
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
    link.download = `fechamento-pitsdog-${normalizedReportStartDate}-a-${normalizedReportEndDate}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    showNotice(`Relatório de ${reportPeriodLabel} exportado.`)
  }

  async function updateSelectedOrder(changes: Partial<Order>, message: string) {
    if (!selectedOrder) return false

    if (selectedOrder.delivery === "Delivery" && changes.status === "saiu" && !selectedOrder.courierId) {
      showNotice("Selecione um motoboy antes de enviar o pedido para entrega.")
      return false
    }

    const orderId = selectedOrder.backendId ?? selectedOrder.id
    const previousOrder = selectedOrder
    const isStatusAction = "status" in changes || "backendStatus" in changes

    if (updatingOrderIdsRef.current.has(orderId)) return false

    updatingOrderIdsRef.current.add(orderId)
    setUpdatingOrderIds((currentIds) => new Set(currentIds).add(orderId))
    setActionOverlayLabel(isStatusAction ? "Atualizando pedido..." : "Salvando alterações do pedido...")

    // Para evitar que os itens sumam após o sync do backend,
    // garantimos que o payload de atualização contenha os itens atuais
    const updatePayload = {
      ...changes,
      items: changes.items ?? selectedOrder.items,
    }

    applyOrderChanges(orderId, updatePayload)

    try {
      const updated = await updateOrder(orderId, updatePayload, message)

      if (!updated) {
        applyOrderChanges(orderId, previousOrder)
        showNotice("Não foi possível salvar na API agora. Alteração desfeita e registrada como pendente.")
        return false
      }

      if (isStatusAction) {
        showStatusToast(getShortStatusMessage(changes, message))

        if (changes.status === "preparando" && localPanelSettings.autoPrint) {
          void printApprovalTickets({ ...previousOrder, ...changes }, { copies: localPanelSettings.printCopies }).catch((error) => {
            console.warn("Não foi possível imprimir a comanda automaticamente.", error)
            showNotice(error instanceof Error ? error.message : "Não foi possível imprimir a comanda automaticamente.")
          })
        }

        const whatsAppEvent = getWhatsAppEventForOrderStatus(changes.status)

        if (whatsAppEvent) {
          void notifyWhatsAppOrderStatus(whatsAppEvent, { ...previousOrder, ...changes }).catch((error) => {
            const message = error instanceof Error ? error.message : "Não foi possível enviar atualização pelo WhatsApp."

            console.warn("Não foi possível enviar atualização pelo WhatsApp.", error)
            showNotice(message)
          })
        }
      } else {
        showStatusToast(getShortStatusMessage(changes, message), 8500)
        showNotice(message)
      }

      return true
    } catch (error) {
      applyOrderChanges(orderId, previousOrder)
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar a alteração agora.")
      return false
    } finally {
      setUpdatingOrderIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(orderId)
        return nextIds
      })
      updatingOrderIdsRef.current.delete(orderId)
      setActionOverlayLabel("")
    }
  }

  async function restoreSelectedOrder() {
    if (!selectedOrder) return false

    const orderId = selectedOrder.backendId ?? selectedOrder.id
    if (updatingOrderIdsRef.current.has(orderId)) return false

    updatingOrderIdsRef.current.add(orderId)
    setUpdatingOrderIds((currentIds) => new Set(currentIds).add(orderId))

    try {
      const updated = await restoreOrder(selectedOrder)

      if (updated) {
        showStatusToast("Pedido restaurado")
      }

      return updated
    } finally {
      setUpdatingOrderIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(orderId)
        return nextIds
      })
      updatingOrderIdsRef.current.delete(orderId)
    }
  }

  function startEdit() {
    if (!selectedOrder) return
    if (selectedOrder.status === "cancelado") {
      showNotice("Pedido cancelado não pode ser editado. Restaure o pedido antes de alterar.")
      return
    }

    const parsedTableNumber = selectedOrder.delivery === "Mesa"
      ? selectedOrder.address.replace(/^Mesa\s*/i, "")
      : ""

    setDraft({
      address: selectedOrder.address,
      changeFor: selectedOrder.changeFor ?? 0,
      complement: "",
      courierId: selectedOrder.courierId ?? "",
      customer: selectedOrder.customer,
      delivery: selectedOrder.delivery,
      deliveryFee: selectedOrder.delivery === "Delivery"
        ? selectedOrder.deliveryFee ?? localPanelSettings.defaultDeliveryFee
        : 0,
      discount: selectedOrder.discount ?? 0,
      discountPercent: selectedOrder.discountPercent ?? 0,
      discountReason: selectedOrder.discountReason ?? "",
      items: selectedOrder.items.length ? selectedOrder.items : [""],
      needsChange: selectedOrder.needsChange ?? false,
      neighborhood: "",
      notes: selectedOrder.notes ?? "",
      payment: selectedOrder.payment,
      phone: selectedOrder.phone,
      productCategoryToAddId: menuAdmin.categories.find((category) => category.ativo)?.id ?? 0,
      productToAddId: 0,
      productToAddNote: "",
      productToAddQuantity: 1,
      street: selectedOrder.delivery === "Delivery" ? selectedOrder.address : "",
      subtotal: selectedOrder.subtotal ?? selectedOrder.total,
      tableNumber: parsedTableNumber === "-" ? "" : parsedTableNumber,
      total: calculateOrderTotal(selectedOrder),
    })
    setIsEditing(true)
    setIsCanceling(false)
    showNotice(`Editando pedido #${selectedOrder.id}.`)
  }

  async function saveEdit() {
    if (!draft || !selectedOrder) return
    showNotice(`Salvando alterações do pedido #${selectedOrder.id}...`)

    const selectedCourier = couriers.find((courier) => courier.id === draft.courierId)
    const discountChanges = {
      discount: draft.discount > 0 ? draft.discount : undefined,
      discountPercent: draft.discountPercent > 0 ? Math.min(draft.discountPercent, 35) : undefined,
      discountReason: draft.discountReason.trim() || undefined,
    }

    const updated = await updateSelectedOrder({
      address: formatDraftAddress(draft),
      changeFor: draft.payment === "Dinheiro" && draft.needsChange ? draft.changeFor : undefined,
      courierId: draft.delivery === "Delivery" ? draft.courierId || undefined : undefined,
      courierName: draft.delivery === "Delivery" ? selectedCourier?.name : undefined,
      customer: draft.customer,
      delivery: draft.delivery,
      deliveryFee: draft.delivery === "Delivery" ? draft.deliveryFee : 0,
      ...discountChanges,
      items: draft.items.map((item) => item.trim()).filter(Boolean),
      needsChange: draft.payment === "Dinheiro" ? draft.needsChange : undefined,
      notes: draft.notes,
      payment: draft.payment,
      phone: draft.phone,
      subtotal: draft.subtotal,
      total: calculateDraftTotal(draft),
    }, `Pedido #${selectedOrder.id} atualizado no painel.`)

    if (updated) {
      setIsEditing(false)
      setDraft(null)
      showStatusToast(`Pedido #${selectedOrder.id} atualizado com sucesso.`, 9000)
    }
  }

  function addDraftProduct() {
    if (!draft || !draft.productToAddId) return

    const product = menuAdmin.products.find((currentProduct) => currentProduct.id === draft.productToAddId)

    if (!product) return

    const quantity = Math.max(1, draft.productToAddQuantity)
    const note = draft.productToAddNote.trim() ? ` (${draft.productToAddNote.trim()})` : ""
    const itemText = `${quantity}x ${product.nome}${note}`

    setDraft({
      ...draft,
      items: [...draft.items, itemText],
      productCategoryToAddId: draft.productCategoryToAddId,
      productToAddId: 0,
      productToAddNote: "",
      productToAddQuantity: 1,
      subtotal: Number((draft.subtotal + product.preco * quantity).toFixed(2)),
      total: Number((calculateDraftTotal({ ...draft, subtotal: draft.subtotal + product.preco * quantity })).toFixed(2)),
    })
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
      showNotice(message)
      return
    }

    setCategorySaving(true)
    setCategoryFeedback("Salvando categoria na API...")
    setActionOverlayLabel(editingCategoryId ? "Salvando edição da categoria..." : "Adicionando categoria...")
    showNotice("Salvando categoria na API...")

    try {
      if (editingCategoryId) {
        await menuAdmin.updateCategory(editingCategoryId, categoryDraft)
        showNotice(`${categoryDraft.nome} atualizado no cardápio.`)
        showStatusToast(`${categoryDraft.nome} atualizado no cardápio.`, 8500)
        setCategoryFeedback(`${categoryDraft.nome} atualizado no cardápio.`)
      } else {
        await menuAdmin.createCategory(categoryDraft)
        showNotice(`${categoryDraft.nome} cadastrado no cardápio.`)
        showStatusToast(`${categoryDraft.nome} cadastrado no cardápio.`, 8500)
        setCategoryFeedback(`${categoryDraft.nome} cadastrado no cardápio.`)
      }

      setCategoryDraft(emptyCategoryDraft)
      setEditingCategoryId(null)
    } catch (error) {
      console.error("Erro ao salvar categoria", error)
      showNotice("Não foi possível salvar a categoria na API agora.")
      setCategoryFeedback("Não foi possível salvar a categoria na API agora. Veja o console para o erro da API.")
    } finally {
      setCategorySaving(false)
      setActionOverlayLabel("")
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
    showNotice(`Editando categoria ${category.nome}.`)
  }

  function cancelCategoryEdit() {
    setCategoryDraft(emptyCategoryDraft)
    setEditingCategoryId(null)
    setCategoryFeedback("")
    showNotice("Edição de categoria cancelada.")
  }

  async function toggleCategoryStatus(category: MenuCategory) {
    const nextStatus = !category.ativo

    menuAdmin.applyCategoryStatus(category.id, nextStatus)
    showNotice(nextStatus ? "Categoria ativada no painel." : "Categoria desativada no painel.")

    try {
      try {
        await menuAdmin.updateCategoryStatus(category.id, nextStatus)
      } catch {
        await menuAdmin.updateCategory(category.id, {
          ativo: nextStatus,
          descricao: category.descricao,
          imagem: category.imagem ?? "",
          nome: category.nome,
          ordem: category.ordem,
        })
      }
      showNotice(nextStatus ? "Categoria ativada no cardápio." : "Categoria desativada no cardápio.")
    } catch (error) {
      menuAdmin.applyCategoryStatus(category.id, category.ativo)
      showNotice(error instanceof Error ? error.message : "Não foi possível alterar a categoria na API agora.")
    }
  }

  async function saveProduct() {
    if (!productDraft.nome.trim() || !productDraft.categoriaId) {
      showNotice("Informe nome e categoria para salvar o produto.")
      return
    }

    setProductSaving(true)
    setActionOverlayLabel(editingProductId ? "Salvando edição do produto..." : "Adicionando produto...")
    showNotice(editingProductId ? "Salvando edição do produto..." : "Adicionando produto...")

    try {
      if (editingProductId) {
        await menuAdmin.updateProduct(editingProductId, productDraft)
        showNotice(`${productDraft.nome} atualizado no cardápio.`)
        showStatusToast(`${productDraft.nome} atualizado no cardápio.`, 8500)
      } else {
        await menuAdmin.createProduct(productDraft)
        showNotice(`${productDraft.nome} cadastrado no cardápio.`)
        showStatusToast(`${productDraft.nome} cadastrado no cardápio.`, 8500)
      }

      setProductDraft(emptyProductDraft)
      setEditingProductId(null)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar o produto na API agora.")
    } finally {
      setProductSaving(false)
      setActionOverlayLabel("")
    }
  }

  function editProduct(product: MenuProduct) {
    setEditingProductId(product.id)
    setProductDraft({
      ativo: product.ativo,
      addonIds: product.addonIds ?? [],
      categoriaId: product.categoriaId,
      descricao: product.descricao,
      flavorIds: product.flavorIds ?? [],
      flavorRequired: product.flavorRequired ?? false,
      hasFlavors: product.hasFlavors ?? false,
      highlight: product.highlight ?? product.subtitle ?? "",
      imagem: product.imageUrl ?? product.imagem ?? "",
      maxFlavors: product.maxFlavors ?? 1,
      nome: product.nome,
      permiteAdicionais: product.permiteAdicionais ?? false,
      preco: product.preco,
    })
    setMenuPanelSection("produtos")
    showNotice(`Editando produto ${product.nome}.`)
  }

  function cancelProductEdit() {
    setProductDraft(emptyProductDraft)
    setEditingProductId(null)
    showNotice("Edição de produto cancelada.")
  }

  async function toggleProductStatus(product: MenuProduct) {
    const nextStatus = !product.ativo

    menuAdmin.applyProductStatus(product.id, nextStatus)
    showNotice(nextStatus ? "Produto ativado no painel." : "Produto desativado no painel.")

    try {
      try {
        await menuAdmin.updateProductStatus(product)
      } catch {
        await menuAdmin.updateProduct(product.id, {
          ativo: nextStatus,
          addonIds: product.addonIds ?? [],
          categoriaId: product.categoriaId,
          descricao: product.descricao,
          flavorIds: product.flavorIds ?? [],
          flavorRequired: product.flavorRequired ?? false,
          hasFlavors: product.hasFlavors ?? false,
          highlight: product.highlight ?? product.subtitle ?? "",
          imagem: product.imageUrl ?? product.imagem ?? "",
          maxFlavors: product.maxFlavors ?? 1,
          nome: product.nome,
          permiteAdicionais: product.permiteAdicionais ?? false,
          preco: product.preco,
        })
      }
      showNotice(nextStatus ? "Produto ativado no cardápio." : "Produto desativado no cardápio.")
    } catch (error) {
      menuAdmin.applyProductStatus(product.id, product.ativo)
      showNotice(error instanceof Error ? error.message : "Não foi possível alterar o produto na API agora.")
    }
  }

  async function saveAdditional() {
    if (!additionalDraft.nome.trim()) {
      showNotice("Informe o nome do adicional.")
      return
    }

    setAdditionalSaving(true)
    setActionOverlayLabel(editingAdditionalId ? "Salvando edição do adicional..." : "Adicionando adicional...")
    showNotice(editingAdditionalId ? "Salvando edição do adicional..." : "Adicionando adicional...")

    try {
      if (editingAdditionalId) {
        await menuAdmin.updateAdditional(editingAdditionalId, additionalDraft)
        showNotice(`${additionalDraft.nome} atualizado no cardápio.`)
        showStatusToast(`${additionalDraft.nome} atualizado no cardápio.`, 8500)
      } else {
        await menuAdmin.createAdditional(additionalDraft)
        showNotice(`${additionalDraft.nome} cadastrado no cardápio.`)
        showStatusToast(`${additionalDraft.nome} cadastrado no cardápio.`, 8500)
      }

      setAdditionalDraft(emptyAdditionalDraft)
      setEditingAdditionalId(null)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar o adicional na API agora.")
    } finally {
      setAdditionalSaving(false)
      setActionOverlayLabel("")
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
    showNotice(`Editando adicional ${additional.nome}.`)
  }

  function cancelAdditionalEdit() {
    setAdditionalDraft(emptyAdditionalDraft)
    setEditingAdditionalId(null)
    showNotice("Edição de adicional cancelada.")
  }

  async function toggleAdditionalStatus(additional: MenuAdditional) {
    const nextStatus = !additional.ativo

    menuAdmin.applyAdditionalStatus(additional.id, nextStatus)
    showNotice(nextStatus ? "Adicional ativado no painel." : "Adicional desativado no painel.")

    try {
      try {
        await menuAdmin.updateAdditionalStatus(additional)
      } catch {
        await menuAdmin.updateAdditional(additional.id, {
          ativo: nextStatus,
          descricao: additional.descricao,
          nome: additional.nome,
          preco: additional.preco,
        })
      }
      showNotice(nextStatus ? "Adicional ativado no cardápio." : "Adicional desativado no cardápio.")
    } catch (error) {
      menuAdmin.applyAdditionalStatus(additional.id, additional.ativo)
      showNotice(error instanceof Error ? error.message : "Não foi possível alterar o adicional na API agora.")
    }
  }

  function openProductAddons(product: MenuProduct) {
    const addonIds = product.addonIds ?? []

    setAddonModalProduct(product)
    setAddonModalSelectedIds(addonIds)
    setAddonModalInitialIds(addonIds)
    setAddonModalFeedback("")
    setAddonModalSearch("")
  }

  function closeProductAddons() {
    const hasPendingChanges = addonModalSelectedIds.slice().sort().join("|") !== addonModalInitialIds.slice().sort().join("|")

    if (hasPendingChanges && !window.confirm("Existem alterações não salvas. Deseja sair?")) return

    setAddonModalProduct(null)
    setAddonModalSelectedIds([])
    setAddonModalInitialIds([])
    setAddonModalFeedback("")
    setAddonModalSearch("")
  }

  async function saveProductAddons() {
    if (!addonModalProduct) return

    setAddonModalSaving(true)
    setAddonModalFeedback("")

    const productId = addonModalProduct.id
    const nextAddonIds = addonModalSelectedIds

    try {
      let relationWarning = ""

      try {
        await addonsApi.updateProductAddons(String(productId), nextAddonIds)
      } catch (error) {
        relationWarning = error instanceof Error ? error.message : "A API ainda não possui suporte para vínculo de adicionais por produto."
      }

      await menuAdmin.updateProduct(productId, {
        addonIds: nextAddonIds,
        ativo: addonModalProduct.ativo,
        categoriaId: addonModalProduct.categoriaId,
        descricao: addonModalProduct.descricao,
        flavorIds: addonModalProduct.flavorIds ?? [],
        flavorRequired: addonModalProduct.flavorRequired ?? false,
        hasFlavors: addonModalProduct.hasFlavors ?? false,
        highlight: addonModalProduct.highlight ?? addonModalProduct.subtitle ?? "",
        imagem: addonModalProduct.imageUrl ?? addonModalProduct.imagem ?? "",
        maxFlavors: addonModalProduct.maxFlavors ?? 1,
        nome: addonModalProduct.nome,
        permiteAdicionais: nextAddonIds.length > 0 || Boolean(addonModalProduct.permiteAdicionais),
        preco: addonModalProduct.preco,
      })
      setAddonModalFeedback(relationWarning ? `${relationWarning} Vínculo enviado junto ao produto.` : "Adicionais vinculados ao produto.")
      setAddonModalInitialIds(nextAddonIds)
      showStatusToast("Adicionais do produto salvos.")
    } catch (error) {
      setAddonModalFeedback(error instanceof Error ? `${error.message} Vínculo mantido localmente.` : "Vínculo mantido localmente.")
      menuAdmin.applyProductStatus(productId, addonModalProduct.ativo)
    } finally {
      setAddonModalSaving(false)
    }
  }

  const filters: Array<{ label: string; value: OrderFilter; count: number }> = [
    { label: "Todos os pedidos", value: "todos", count: counts.all },
    { label: "Mesa", value: "mesa", count: counts.mesa },
    { label: "Retirada", value: "retirada", count: counts.retirada },
    { label: "Entrega", value: "entrega", count: counts.entrega },
  ]
  const SelectedDeliveryIcon = selectedOrder ? deliveryIcons[selectedOrder.delivery] ?? PackageCheck : PackageCheck
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
    "not-configured": "Cardápio sem backend",
    offline: "Cardápio offline",
    online: "Cardápio conectado",
  }[menuAdmin.status]
  const backendReady = connectionStatus === "online"
  const activePanel = settingsPanelOpen
    ? "configuracoes"
    : deliveryPeoplePanelOpen
      ? "motoboys"
      : flavorsPanelOpen
        ? "sabores"
        : menuPanelOpen
          ? menuPanelSection
          : zapPanelOpen
            ? "zap"
            : cashPanelOpen
              ? "caixa"
              : clientsPanelOpen
                ? "clientes"
                : ordersView
  const showingOrdersPanel = activePanel === "pedidos" || activePanel === "dashboard"
  const navigationItems = [
    { description: `${counts.novo} novos`, icon: LayoutDashboard, label: "Dashboard", value: "dashboard" },
    { description: `${visibleOrders.length} na tela`, icon: PackageCheck, label: "Pedidos", value: "pedidos" },
    { description: `${visibleProducts.length} produtos`, icon: Store, label: "Produtos", value: "produtos" },
    { description: `${menuAdmin.categories.length} categorias`, icon: Settings, label: "Categorias", value: "categorias" },
    { description: `${menuAdmin.additionals.length} adicionais`, icon: Plus, label: "Adicionais", value: "adicionais" },
    { description: `${flavors.length} sabores`, icon: Tag, label: "Sabores", value: "sabores" },
    { description: `${couriers.length} cadastrados`, icon: Bike, label: "Motoboys", value: "motoboys" },
    { description: "Sistema e impressão", icon: Settings, label: "Configurações", value: "configuracoes" },
  ] as const

  function showPanel(panel: MainPanel) {
    const menuSections: Partial<Record<MainPanel, MenuPanelSection>> = {
      "cardápio": "produtos",
      adicionais: "adicionais",
      categorias: "categorias",
      produtos: "produtos",
    }
    const nextMenuSection = menuSections[panel]

    if (nextMenuSection) setMenuPanelSection(nextMenuSection)
    if (panel === "dashboard" || panel === "pedidos") setOrdersView(panel)

    setMenuPanelOpen(Boolean(nextMenuSection))
    setCashPanelOpen(panel === "caixa")
    setClientsPanelOpen(panel === "clientes")
    setZapPanelOpen(panel === "zap")
    setDeliveryPeoplePanelOpen(panel === "motoboys")
    setFlavorsPanelOpen(panel === "sabores")
    setSettingsPanelOpen(panel === "configuracoes")
    showNotice(
      panel === "pedidos" || panel === "dashboard"
        ? "Tela principal de pedidos aberta."
        : nextMenuSection
          ? `Gerenciamento de ${nextMenuSection} aberto.`
          : panel === "sabores"
            ? "Gerenciamento de sabores aberto."
            : panel === "motoboys"
              ? "Gerenciamento de entregadores aberto."
              : panel === "configuracoes"
                ? "Configurações técnicas abertas."
                : panel === "caixa"
                  ? "Fluxo de caixa aberto."
                  : panel === "clientes"
                    ? "Histórico de clientes aberto."
                    : "Central do Zap aberta."
    )
  }

  useEffect(() => {
    const hasSecondaryScreen = isEditing || isCanceling || Boolean(errorDialog) || (activePanel !== "pedidos" && activePanel !== "dashboard")

    if (!hasSecondaryScreen) return

    const guardState = { pitsDogAdminBackGuard: true }

    window.history.pushState(guardState, "", window.location.href)

    function handlePopState() {
      if (errorDialog) {
        setErrorDialog(null)
      } else if (isEditing) {
        setIsEditing(false)
        setDraft(null)
        setNotice(selectedOrder ? `Edição do pedido #${selectedOrder.id} fechada.` : "Edição fechada.")
      } else if (isCanceling) {
        setIsCanceling(false)
      } else if (activePanel !== "pedidos" && activePanel !== "dashboard") {
        setMenuPanelOpen(false)
        setCashPanelOpen(false)
        setClientsPanelOpen(false)
        setZapPanelOpen(false)
        setDeliveryPeoplePanelOpen(false)
        setFlavorsPanelOpen(false)
        setSettingsPanelOpen(false)
        setNotice("Tela principal de pedidos aberta.")
      }

      window.history.pushState(guardState, "", window.location.href)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [activePanel, errorDialog, isCanceling, isEditing, selectedOrder])

  useEffect(() => {
    if (!menuPanelOpen && !cashPanelOpen) return

    void menuAdmin.loadMenu()
  }, [cashPanelOpen, menuPanelOpen])

  return (
    <MainLayout>
      <div className={`flex h-full w-full flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-5 ${
        storeOpen ? "bg-white/[0.03]" : "bg-red-950/35"
      } ${localPanelSettings.compactMode ? "text-[0.93rem]" : ""}`}>
        {statusToast && (
          <div
            key={statusToast.id}
            className="fixed left-1/2 top-5 z-[80] flex min-h-12 w-[min(94vw,560px)] -translate-x-1/2 items-center justify-center gap-2 rounded-lg border border-emerald-200/45 bg-emerald-400 px-4 py-3 text-center text-sm font-black text-black shadow-[0_22px_70px_rgba(52,211,153,0.34)]"
            role="status"
          >
            <Check size={17} />
            <span>{statusToast.message}</span>
          </div>
        )}

        {actionOverlayLabel && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="status" aria-live="polite">
            <div className="grid w-full max-w-sm justify-items-center gap-3 rounded-lg border border-orange-300/25 bg-[#100b08] px-5 py-6 text-center shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
              <Loader2 className="animate-spin text-orange-300" size={34} />
              <strong className="text-base font-black text-white">{actionOverlayLabel}</strong>
              <p className="text-sm font-bold text-zinc-400">Aguarde a confirmação antes de clicar de novo.</p>
            </div>
          </div>
        )}

        {errorDialog && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
            <section
              className="w-full max-w-md overflow-hidden rounded-lg border border-red-300/30 bg-[#120b08] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dashboard-error-title"
            >
              <header className="border-b border-red-300/15 bg-red-500/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-red-400 text-black">
                    <AlertTriangle size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-200">
                      Erro do painel
                    </p>
                    <h2 id="dashboard-error-title" className="mt-1 text-xl font-black text-white">
                      {errorDialog.title}
                    </h2>
                  </div>
                </div>
              </header>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">O que aconteceu</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-white">{errorDialog.message}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-300">Por quê</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{errorDialog.reason}</p>
                </div>
              </div>

              <footer className="border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setErrorDialog(null)}
                  className="h-11 w-full rounded-lg bg-orange-400 text-sm font-black text-black transition hover:bg-orange-300"
                >
                  Continuar
                </button>
              </footer>
            </section>
          </div>
        )}

        {!storeOpen && (
          <div className="mb-3 shrink-0 rounded-lg border border-red-300/35 bg-red-500/20 px-4 py-3 shadow-[0_18px_48px_rgba(239,68,68,0.18)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <strong className="text-sm font-black uppercase tracking-[0.16em] text-red-100">
                Loja fechada
              </strong>
              <span className="text-xs font-bold text-red-100/75">
                O cardápio deve bloquear novos pedidos enquanto este estado estiver fechado.
              </span>
            </div>
          </div>
        )}

        <DashboardHeader
          activePanel={activePanel}
          backendReady={backendReady}
          connectionStatus={connectionStatus}
          isSyncing={isSyncing}
          localPanelSettings={localPanelSettings}
          navigationItems={navigationItems}
          notice={notice}
          onActivateSound={orderSound.activateSound}
          onLogout={onLogout}
          onNotice={showNotice}
          onPreviewSound={orderSound.previewSound}
          onShowPanel={(panel) => showPanel(panel as MainPanel)}
          onSoundModeChange={setSoundModeId}
          onToggleStore={updateStoreStatus}
          orderSoundNeedsActivation={orderSound.needsActivation}
          setLocalPanelSettings={setLocalPanelSettings}
          setSoundEnabled={setSoundEnabled}
          setStoreOpen={setStoreOpen}
          soundEnabled={soundEnabled}
          soundModeId={soundModeId}
          soundModes={newOrderSoundModes}
          storeOpen={storeOpen}
        />

        {showingOrdersPanel && (
          <OrderMetrics
            activeStatusFilter={activeStatusFilter}
            cashOrdersCount={cashOrders.length}
            menuSignal={menuSignal}
            metrics={metrics}
            onMetricClick={(status, label) => {
              setActiveStatusFilter(status as StatusFilter)
              showPanel("pedidos")
              showNotice(status === "todos" ? "Mostrando todos os pedidos." : `Filtro aplicado: ${label}.`)
            }}
            syncClock={syncClock}
          />
        )}

        {deliveryPeoplePanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Entregas</p>
                <h2 className="text-xl font-black text-white">Motoboys / Entregadores</h2>
              </div>
              <button type="button" onClick={() => showPanel("pedidos")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                <LayoutDashboard size={15} />
                Voltar aos pedidos
              </button>
            </div>

            {courierFeedback && (
              <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-sm font-bold leading-6 text-cyan-50/80">
                {courierFeedback}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Plus size={16} className="text-orange-300" />
                  {editingCourierId ? "Editar entregador" : "Novo entregador"}
                </div>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Nome</span>
                    <input value={courierDraft.name} onChange={(event) => setCourierDraft({ ...courierDraft, name: event.target.value })} placeholder="Nome do motoboy" className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Telefone / WhatsApp</span>
                    <input value={courierDraft.phone ?? ""} onChange={(event) => setCourierDraft({ ...courierDraft, phone: event.target.value })} placeholder="(91) 99999-9999" className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Observação</span>
                    <textarea value={courierDraft.notes ?? ""} onChange={(event) => setCourierDraft({ ...courierDraft, notes: event.target.value })} placeholder="Turno, região, documento..." className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500" />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Entregador ativo
                    <input type="checkbox" checked={courierDraft.active} onChange={(event) => setCourierDraft({ ...courierDraft, active: event.target.checked })} className="h-4 w-4 accent-orange-400" />
                  </label>
                  <button type="button" onClick={() => void addCourier()} disabled={courierSaving || !courierDraft.name.trim()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
                    {courierSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {courierSaving ? "Salvando..." : editingCourierId ? "Salvar entregador" : "Cadastrar entregador"}
                  </button>
                  {editingCourierId && (
                    <button type="button" onClick={() => { setCourierDraft(emptyDeliveryPersonDraft); setEditingCourierId(null) }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                      <X size={15} />
                      Cancelar edição
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">Entregadores cadastrados</p>
                    <p className="mt-1 text-xs text-zinc-500">Pesquise, edite, ative/inative e atribua nos pedidos de entrega.</p>
                  </div>
                  <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400 lg:w-72">
                    <Search size={15} />
                    <input value={deliveryPersonSearch} onChange={(event) => setDeliveryPersonSearch(event.target.value)} className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500" placeholder="Buscar nome ou telefone" />
                  </label>
                </div>

                <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {visibleDeliveryPeople.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhum entregador encontrado.
                    </div>
                  )}
                  {visibleDeliveryPeople.map((courier) => (
                    <div key={courier.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-black text-white">{courier.name}</strong>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${courier.active ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-red-300/25 bg-red-400/10 text-red-100"}`}>
                            {courier.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{courier.phone || "Sem telefone"} {courier.notes ? `| ${courier.notes}` : ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => editCourier(courier)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                          <Edit3 size={14} />
                          Editar
                        </button>
                        <button type="button" onClick={() => void toggleCourierStatus(courier)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition ${courier.active ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]" : "bg-emerald-400 text-black hover:bg-emerald-300"}`}>
                          {courier.active ? "Inativar" : "Ativar"}
                        </button>
                        <button type="button" onClick={() => void deleteCourier(courier)} className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.18]">
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

        {flavorsPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Variações de produto</p>
                <h2 className="text-xl font-black text-white">Sabores</h2>
              </div>
              <button type="button" onClick={() => showPanel("pedidos")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                <LayoutDashboard size={15} />
                Voltar aos pedidos
              </button>
            </div>

            {flavorFeedback && (
              <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-sm font-bold leading-6 text-cyan-50/80">
                {flavorFeedback}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Plus size={16} className="text-orange-300" />
                  {editingFlavorId ? "Editar sabor" : "Novo sabor"}
                </div>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Nome do sabor</span>
                    <input value={flavorDraft.name} onChange={(event) => setFlavorDraft({ ...flavorDraft, name: event.target.value })} placeholder="Ex: Maracujá, Coca-Cola, Uva" className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Categoria opcional</span>
                      <select value={flavorDraft.categoryId ?? ""} onChange={(event) => setFlavorDraft({ ...flavorDraft, categoryId: event.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none">
                        <option value="">Sem categoria</option>
                        {menuAdmin.categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.nome}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Produto opcional</span>
                      <select value={flavorDraft.productId ?? ""} onChange={(event) => setFlavorDraft({ ...flavorDraft, productId: event.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none">
                        <option value="">Sem produto específico</option>
                        {menuAdmin.products.map((product) => (
                          <option key={product.id} value={product.id}>{product.nome}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Observação</span>
                    <textarea value={flavorDraft.notes ?? ""} onChange={(event) => setFlavorDraft({ ...flavorDraft, notes: event.target.value })} placeholder="Ex: disponível só para sucos naturais" className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500" />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Sabor ativo
                    <input type="checkbox" checked={flavorDraft.active} onChange={(event) => setFlavorDraft({ ...flavorDraft, active: event.target.checked })} className="h-4 w-4 accent-orange-400" />
                  </label>
                  <button type="button" onClick={() => void saveFlavor()} disabled={flavorSaving || !flavorDraft.name.trim()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
                    {flavorSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {flavorSaving ? "Salvando..." : editingFlavorId ? "Salvar sabor" : "Cadastrar sabor"}
                  </button>
                  {editingFlavorId && (
                    <button type="button" onClick={() => { setFlavorDraft(emptyFlavorDraft); setEditingFlavorId(null) }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                      <X size={15} />
                      Cancelar edição
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">Sabores cadastrados</p>
                    <p className="mt-1 text-xs text-zinc-500">Sabores são escolhas do produto, separados de adicionais pagos.</p>
                  </div>
                  <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400 lg:w-72">
                    <Search size={15} />
                    <input value={flavorSearch} onChange={(event) => setFlavorSearch(event.target.value)} className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500" placeholder="Buscar sabor" />
                  </label>
                </div>

                <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {visibleFlavors.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhum sabor encontrado.
                    </div>
                  )}
                  {visibleFlavors.map((flavor) => {
                    const categoryName = flavor.categoryId ? menuAdmin.categories.find((category) => String(category.id) === flavor.categoryId)?.nome : ""
                    const productName = flavor.productId ? menuAdmin.products.find((product) => String(product.id) === flavor.productId)?.nome : ""

                    return (
                      <div key={flavor.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm font-black text-white">{flavor.name}</strong>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${flavor.active ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-red-300/25 bg-red-400/10 text-red-100"}`}>
                              {flavor.active ? "Ativo" : "Inativo"}
                            </span>
                            {categoryName && <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-100">{categoryName}</span>}
                            {productName && <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-orange-100">{productName}</span>}
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">{flavor.notes || "Sem observação"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => editFlavor(flavor)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                            <Edit3 size={14} />
                            Editar
                          </button>
                          <button type="button" onClick={() => void toggleFlavorStatus(flavor)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition ${flavor.active ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]" : "bg-emerald-400 text-black hover:bg-emerald-300"}`}>
                            {flavor.active ? "Inativar" : "Ativar"}
                          </button>
                          <button type="button" onClick={() => void deleteFlavor(flavor)} className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-xs font-black text-red-100 transition hover:bg-red-400/[0.18]">
                            Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {settingsPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Sistema</p>
                <h2 className="text-xl font-black text-white">Configurações</h2>
              </div>
              <button type="button" onClick={() => showPanel("pedidos")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                <LayoutDashboard size={15} />
                Voltar aos pedidos
              </button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Printer size={16} className="text-orange-300" />
                  Impressora térmica
                </div>
                {!window.pitsDog?.printer && (
                  <div className="mt-3 rounded-lg border border-orange-300/20 bg-orange-400/[0.08] p-3 text-xs font-bold leading-5 text-orange-50/80">
                    Impressão direta disponível apenas no app desktop.
                  </div>
                )}
                {printerFeedback && (
                  <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-xs font-bold leading-5 text-cyan-50/80">
                    {printerFeedback}
                  </div>
                )}
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">IP/Host da impressora</span>
                    <input
                      disabled={!window.pitsDog?.printer || printerLoading}
                      value={printerConfig.host}
                      onChange={(event) => setPrinterConfig({ ...printerConfig, host: event.target.value })}
                      placeholder="192.168.3.17"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Porta</span>
                    <input
                      disabled={!window.pitsDog?.printer || printerLoading}
                      value={printerConfig.port}
                      onChange={(event) => setPrinterConfig({ ...printerConfig, port: Number(event.target.value) || 9100 })}
                      placeholder="9100"
                      type="number"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Ativar impressão direta
                    <input
                      disabled={!window.pitsDog?.printer || printerLoading}
                      type="checkbox"
                      checked={printerConfig.enabled}
                      onChange={(event) => setPrinterConfig({ ...printerConfig, enabled: event.target.checked })}
                      className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Imprimir automaticamente ao aceitar
                    <input
                      disabled={!window.pitsDog?.printer || printerLoading}
                      type="checkbox"
                      checked={localPanelSettings.autoPrint}
                      onChange={(event) => {
                        setLocalPanelSettings((settings) => ({ ...settings, autoPrint: event.target.checked }))
                        setPrinterConfig({ ...printerConfig, autoPrintOnAccept: event.target.checked })
                      }}
                      className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" onClick={() => void savePrinterSettings()} disabled={!window.pitsDog?.printer || printerLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
                      {printerLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar
                    </button>
                    <button type="button" onClick={() => void checkPrinterConnection()} disabled={!window.pitsDog?.printer || printerLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                      Testar conexão
                    </button>
                    <button type="button" onClick={() => void testPrinter()} disabled={!window.pitsDog?.printer || printerLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50">
                      Testar impressão
                    </button>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Store size={16} className="text-orange-300" />
                  Configurações gerais
                </div>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Taxa padrão de entrega</span>
                    <input min={0} step={0.5} type="number" value={localPanelSettings.defaultDeliveryFee} onChange={(event) => setLocalPanelSettings((settings) => ({ ...settings, defaultDeliveryFee: Math.max(0, Number(event.target.value) || 0) }))} className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none" />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                    Modo compacto
                    <input type="checkbox" checked={localPanelSettings.compactMode} onChange={(event) => setLocalPanelSettings((settings) => ({ ...settings, compactMode: event.target.checked }))} className="h-4 w-4 accent-orange-400" />
                  </label>
                </div>
              </article>

              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <MessageCircle size={16} className="text-orange-300" />
                  Integrações
                </div>
                <div className="mt-3 space-y-3">
                  <button type="button" onClick={() => showPanel("zap")} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                    <MessageCircle size={15} />
                    Abrir bot do Zap
                  </button>
                  <a href="https://pitsdog-cardapio-oficial.onrender.com" target="_blank" rel="noreferrer" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300">
                    <Upload size={15} />
                    Abrir cardápio
                  </a>
                </div>
              </article>
            </div>
          </section>
        )}

        {addonModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
            <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-orange-300/25 bg-[#100b08] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
              <header className="flex shrink-0 flex-col gap-3 border-b border-white/10 bg-orange-400/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Gerenciar adicionais</p>
                  <h2 className="mt-1 text-xl font-black text-white">{addonModalProduct.nome}</h2>
                </div>
                <button type="button" onClick={closeProductAddons} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-black text-white transition hover:bg-white/10">
                  <X size={16} />
                  Fechar
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {addonModalFeedback && (
                  <div className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] p-3 text-sm font-bold leading-6 text-cyan-50/80">
                    {addonModalFeedback}
                  </div>
                )}

                <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-zinc-400">
                  <Search size={15} />
                  <input value={addonModalSearch} onChange={(event) => setAddonModalSearch(event.target.value)} className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500" placeholder="Buscar adicional..." />
                </label>

                <div className="mt-3 space-y-2">
                  {menuAdmin.additionals.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhum adicional cadastrado.
                    </div>
                  )}
                  {menuAdmin.additionals.length > 0 && menuAdmin.additionals.filter((additional) => normalizeText(`${additional.nome} ${additional.descricao}`).includes(normalizeText(addonModalSearch))).length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhum resultado na busca.
                    </div>
                  )}
                  {menuAdmin.additionals
                    .filter((additional) => normalizeText(`${additional.nome} ${additional.descricao}`).includes(normalizeText(addonModalSearch)))
                    .map((additional) => {
                      const addonId = String(additional.id)
                      const selected = addonModalSelectedIds.includes(addonId)

                      return (
                        <button
                          key={additional.id}
                          type="button"
                          onClick={() => setAddonModalSelectedIds((currentIds) => (
                            selected ? currentIds.filter((id) => id !== addonId) : [...currentIds, addonId]
                          ))}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                            selected
                              ? "border-orange-300/45 bg-orange-400/15"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                              selected ? "border-orange-300 bg-orange-400 text-black" : "border-white/15 bg-black/20 text-transparent"
                            }`}>
                              <Check size={14} />
                            </span>
                            <span className="min-w-0">
                              <strong className="block truncate text-sm font-black text-white">{additional.nome}</strong>
                              <span className="mt-0.5 block truncate text-xs text-zinc-500">{additional.descricao || "Sem descrição"}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs font-black text-orange-200">{formatCurrency(additional.preco)}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                              additional.ativo ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-red-300/25 bg-red-400/10 text-red-100"
                            }`}>
                              {additional.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>

              <footer className="grid shrink-0 gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
                <button type="button" onClick={closeProductAddons} disabled={addonModalSaving} className="h-11 rounded-lg border border-white/10 bg-white/5 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveProductAddons()}
                  disabled={addonModalSaving || addonModalSelectedIds.slice().sort().join("|") === addonModalInitialIds.slice().sort().join("|")}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-400 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addonModalSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {addonModalSaving ? "Salvando..." : "Salvar alterações"}
                </button>
              </footer>
            </section>
          </div>
        )}

        {isEditing && draft && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
            <section className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-orange-300/25 bg-[#100b08] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
              <header className="flex shrink-0 flex-col gap-3 border-b border-white/10 bg-orange-400/[0.08] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                    Editar pedido #{selectedOrder.id}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">{draft.customer || selectedOrder.customer}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={selectedOrderIsUpdating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-4 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    {selectedOrderIsUpdating ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {selectedOrderIsUpdating ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setDraft(null)
                      showNotice(`Edição do pedido #${selectedOrder.id} cancelada.`)
                    }}
                    disabled={selectedOrderIsUpdating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X size={15} />
                    Fechar
                  </button>
                </div>
              </header>

              {selectedOrderIsUpdating && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]">
                  <div className="grid justify-items-center gap-3 rounded-lg border border-orange-300/25 bg-[#100b08] px-5 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                    <Loader2 className="animate-spin text-orange-300" size={30} />
                    <strong className="text-sm font-black text-white">Salvando pedido #{selectedOrder.id}...</strong>
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
	                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-black/[0.22] p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <User size={16} className="text-orange-300" />
                        <p className="text-sm font-black text-white">Cliente e tipo de pedido</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Cliente</span>
                          <input
                            value={draft.customer}
                            onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Telefone</span>
                          <input
                            value={draft.phone}
                            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                          />
                        </label>
	                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Tipo</span>
	                          <select
	                            value={draft.delivery}
	                            onChange={(event) => updateDraftDelivery(event.target.value as DeliveryType)}
	                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                          >
                            {deliveryOptions.map((delivery) => (
                              <option key={delivery} value={delivery}>{delivery}</option>
                            ))}
                          </select>
                        </label>
	                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Pagamento</span>
	                          <select
	                            value={draft.payment}
	                            onChange={(event) => {
	                              const payment = event.target.value

	                              setDraft({
	                                ...draft,
	                                changeFor: payment === "Dinheiro" ? draft.changeFor : 0,
	                                needsChange: payment === "Dinheiro" ? draft.needsChange : false,
	                                payment,
	                              })
	                            }}
	                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                          >
	                            {paymentOptions.map((payment) => (
	                              <option key={payment} value={payment}>{payment}</option>
	                            ))}
	                          </select>
	                        </label>
	                      </div>

	                      {draft.payment === "Dinheiro" && (
	                        <div className="mt-3 grid gap-3 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-3 md:grid-cols-[180px_minmax(0,1fr)]">
	                          <label className="flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-black/[0.22] px-3 text-sm font-black text-white">
	                            <input
	                              type="checkbox"
	                              checked={draft.needsChange}
	                              onChange={(event) => setDraft({ ...draft, changeFor: event.target.checked ? draft.changeFor : 0, needsChange: event.target.checked })}
	                              className="h-4 w-4 accent-orange-400"
	                            />
	                            Precisa de troco
	                          </label>
	                          {draft.needsChange && (
	                            <label className="block">
	                              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Troco para quanto?</span>
	                              <input
	                                type="number"
		                                min={calculateDraftTotal(draft)}
		                                value={numberInputValue(draft.changeFor)}
	                                onChange={(event) => setDraft({ ...draft, changeFor: Number(event.target.value) })}
	                                className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                              />
	                            </label>
	                          )}
	                        </div>
	                      )}

                      <div className="mt-4 rounded-lg border border-orange-300/15 bg-orange-400/[0.06] p-3">
                        {draft.delivery === "Delivery" && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block md:col-span-2">
                              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Endereço completo</span>
                              <input
                                value={draft.street}
                                onChange={(event) => setDraft({ ...draft, street: event.target.value, address: event.target.value })}
                                placeholder="Rua, número e ponto de referência"
                                className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Bairro</span>
                              <input
                                value={draft.neighborhood}
                                onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })}
                                className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Taxa de entrega</span>
                              <input
                                type="number"
                                min={0}
	                                value={numberInputValue(draft.deliveryFee)}
	                                onChange={(event) => {
	                                  const deliveryFee = Number(event.target.value)

	                                  setDraft({ ...draft, deliveryFee, total: calculateDraftTotal({ ...draft, deliveryFee }) })
	                                }}
                                className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                              />
                            </label>
	                            <label className="block md:col-span-2">
	                              <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Complemento</span>
	                              <input
                                value={draft.complement}
                                onChange={(event) => setDraft({ ...draft, complement: event.target.value })}
                                placeholder="Apartamento, casa, referência..."
	                                className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
	                              />
	                            </label>
	                            {activeCouriers.length > 0 ? (
	                              <label className="block md:col-span-2">
	                                <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Entregador</span>
	                                <select
	                                  value={draft.courierId}
	                                  onChange={(event) => setDraft({ ...draft, courierId: event.target.value })}
	                                  className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                                >
	                                  <option value="">Selecionar motoboy</option>
	                                  {activeCouriers.map((courier) => (
	                                    <option key={courier.id} value={courier.id}>
	                                      {courier.name}
	                                    </option>
	                                  ))}
	                                </select>
	                              </label>
	                            ) : (
	                              <div className="rounded-lg border border-dashed border-orange-300/20 bg-black/[0.18] p-3 text-sm font-bold text-orange-100/70 md:col-span-2">
	                                Cadastre um motoboy no caixa para liberar a seleção de entregador.
	                              </div>
	                            )}
	                          </div>
	                        )}

                        {draft.delivery === "Mesa" && (
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Número da mesa</span>
                            <input
                              value={draft.tableNumber}
                              onChange={(event) => setDraft({ ...draft, tableNumber: event.target.value })}
                              placeholder="Ex: 12"
                              className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                            />
                          </label>
                        )}

                        {draft.delivery === "Retirada" && (
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Identificação da retirada</span>
                            <input
                              value={draft.address}
                              onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                              placeholder="Retirada no balcão, nome de quem retira..."
                              className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                            />
                          </label>
                        )}
                      </div>
                    </div>

	                    <div className="rounded-lg border border-white/10 bg-black/[0.22] p-4">
	                      <div className="mb-4 flex items-center justify-between gap-3">
	                        <div>
	                          <p className="text-sm font-black text-white">Adicionar produto</p>
	                          <p className="mt-1 text-xs text-zinc-500">Escolha a categoria igual no site e mande o item para o pedido final.</p>
	                        </div>
	                      </div>

	                      <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)_90px_auto]">
	                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Categoria</span>
	                          <select
	                            value={draft.productCategoryToAddId}
	                            onChange={(event) => setDraft({ ...draft, productCategoryToAddId: Number(event.target.value), productToAddId: 0 })}
	                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                          >
	                            <option value={0}>Todas</option>
	                            {activeMenuCategories.map((category) => (
	                              <option key={category.id} value={category.id}>{category.nome}</option>
	                            ))}
	                          </select>
	                        </label>
	                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Produto</span>
	                          <select
	                            value={draft.productToAddId}
	                            onChange={(event) => setDraft({ ...draft, productToAddId: Number(event.target.value) })}
	                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                          >
	                            <option value={0}>Selecionar produto</option>
	                            {draftProductsInCategory.map((product) => (
	                              <option key={product.id} value={product.id}>
	                                {product.nome} - {formatCurrency(product.preco)}
	                              </option>
	                            ))}
	                          </select>
	                        </label>
	                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Qtd.</span>
	                        <input
	                          type="number"
	                          min={1}
		                          value={numberInputValue(draft.productToAddQuantity)}
	                          onChange={(event) => setDraft({ ...draft, productToAddQuantity: Number(event.target.value) })}
	                          className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                        />
	                        </label>
	                        <button
	                          type="button"
	                          onClick={addDraftProduct}
	                          disabled={!draft.productToAddId}
	                          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
	                        >
	                          <Plus size={14} />
	                          Adicionar
	                        </button>
                        <input
                          value={draft.productToAddNote}
                          onChange={(event) => setDraft({ ...draft, productToAddNote: event.target.value })}
                          placeholder="Observação do produto novo: sem cebola, gelado, trocar sabor..."
	                          className="h-11 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60 md:col-span-4"
	                        />
	                      </div>
	                    </div>
                  </div>

	                  <aside className="space-y-4">
	                    <div className="rounded-lg border border-orange-300/25 bg-orange-400/[0.08] p-4">
	                      <div className="flex items-center justify-between gap-3">
	                        <div>
	                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-200">Pedido final</p>
	                          <p className="mt-1 text-xs text-orange-100/70">Edite ou remova qualquer item antes de salvar.</p>
	                        </div>
	                        <span className="rounded-lg bg-black/25 px-2 py-1 text-xs font-black text-white">
	                          {draft.items.length} {draft.items.length === 1 ? "item" : "itens"}
	                        </span>
	                      </div>
	                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
	                        {draft.items.length === 0 && (
	                          <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.18] p-4 text-center text-sm font-bold text-orange-100/70">
	                            Nenhum item no pedido.
	                          </div>
	                        )}
	                        {draft.items.map((item, index) => (
	                          <div key={`${index}-${item}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_40px]">
	                            <input
	                              value={item}
	                              onChange={(event) => {
	                                const nextItems = [...draft.items]

	                                nextItems[index] = event.target.value
	                                setDraft({ ...draft, items: nextItems })
	                              }}
	                              placeholder="Ex: 1x X-Bacon + cheddar (sem cebola)"
	                              className="h-11 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
	                            />
	                            <button
	                              type="button"
	                              onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}
	                              className="grid h-11 place-items-center rounded-lg border border-red-300/25 bg-red-400/10 text-red-100 transition hover:bg-red-400/[0.18]"
	                              aria-label="Remover item"
	                            >
	                              <X size={14} />
	                            </button>
	                          </div>
	                        ))}
	                      </div>
	                    </div>

	                    <div className="rounded-lg border border-white/10 bg-black/[0.22] p-4">
                      <p className="text-sm font-black text-white">Valores e desconto</p>
                      <div className="mt-4 space-y-3">
                        <label className="block">
	                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Subtotal do pedido</span>
	                          <input
	                            type="number"
	                            min={0}
		                            value={numberInputValue(draft.subtotal)}
	                            onChange={(event) => {
	                              const subtotal = Number(event.target.value)

	                              setDraft({ ...draft, subtotal, total: calculateDraftTotal({ ...draft, subtotal }) })
	                            }}
	                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
	                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Desconto R$</span>
                            <input
                              type="number"
                              min={0}
	                              value={numberInputValue(draft.discount)}
	                              onChange={(event) => {
	                                const discount = Number(event.target.value)

	                                setDraft({ ...draft, discount, discountPercent: 0, total: calculateDraftTotal({ ...draft, discount, discountPercent: 0 }) })
	                              }}
                              className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Desconto %</span>
                            <input
                              type="number"
                              min={0}
	                              value={numberInputValue(draft.discountPercent)}
	                              onChange={(event) => {
	                                const discountPercent = Math.min(Number(event.target.value), 35)

	                                setDraft({ ...draft, discount: 0, discountPercent, total: calculateDraftTotal({ ...draft, discount: 0, discountPercent }) })
	                              }}
                              className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none focus:border-orange-300/60"
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Motivo do desconto</span>
                          <input
                            value={draft.discountReason}
                            onChange={(event) => setDraft({ ...draft, discountReason: event.target.value })}
                            placeholder="Cortesia, fidelidade, ajuste..."
                            className="h-11 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/[0.22] p-4">
                      <p className="text-sm font-black text-white">Observações internas</p>
                      <textarea
                        value={draft.notes}
                        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                        placeholder="Recados para cozinha, atendimento ou entrega."
                        className="mt-3 min-h-32 w-full resize-none rounded-lg border border-white/10 bg-black/[0.28] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                      />
                    </div>

	                    <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
	                      <p className="text-[10px] font-black uppercase text-emerald-100/70">Prévia do pedido</p>
	                      <strong className="mt-2 block text-2xl text-emerald-100">{formatCurrency(calculateDraftTotal(draft))}</strong>
	                      <p className="mt-2 text-xs font-bold text-emerald-100/70">{formatDraftAddress(draft)}</p>
	                      {draft.delivery === "Delivery" && (
	                        <p className="mt-2 text-xs font-bold text-emerald-100/70">
	                          Entregador: {couriers.find((courier) => courier.id === draft.courierId)?.name ?? "não selecionado"}
	                        </p>
	                      )}
	                      {draft.payment === "Dinheiro" && draft.needsChange && (
	                        <p className="mt-2 text-xs font-bold text-emerald-100/70">
	                          Troco para {formatCurrency(draft.changeFor || 0)}
	                        </p>
	                      )}
	                    </div>
                  </aside>
	              </div>
	            </div>

	            <details className="mt-4 rounded-lg border border-white/10 bg-black/[0.12] p-3">
	              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-white">
	                <span>Configuração de motoboys</span>
	                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
	                  {couriers.length} cadastrados
	                </span>
	              </summary>

	              <div className="mt-4 border-t border-white/10 pt-4">
	                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
	                  <div>
	                    <p className="text-xs font-bold text-zinc-500">Área administrativa de entregadores.</p>
	                  </div>
	                  <div className="grid gap-2 sm:grid-cols-[220px_auto_auto]">
	                    <input
	                      value={courierDraft.name}
	                      onChange={(event) => setCourierDraft({ ...courierDraft, name: event.target.value })}
	                      placeholder="Nome do motoboy"
	                      className="h-10 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
	                    />
	                    <button
	                      type="button"
	                      onClick={addCourier}
	                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
	                    >
	                      <Plus size={14} />
	                      {editingCourierId ? "Salvar" : "Cadastrar"}
	                    </button>
	                    {editingCourierId && (
	                      <button
	                        type="button"
	                        onClick={() => {
	                          setCourierDraft(emptyDeliveryPersonDraft)
	                          setEditingCourierId(null)
	                        }}
	                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
	                      >
	                        <X size={14} />
	                        Cancelar
	                      </button>
	                    )}
	                  </div>
	                </div>

	                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
	                  {courierStats.length === 0 && (
	                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-zinc-500 md:col-span-2 xl:col-span-4">
	                      Nenhum motoboy cadastrado.
	                    </div>
	                  )}
	                  {courierStats.map((courier) => (
	                    <div key={courier.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
	                      <div className="flex items-start justify-between gap-3">
	                        <div className="min-w-0">
	                          <strong className="block truncate text-sm font-black text-white">{courier.name}</strong>
	                          <p className="mt-1 truncate text-xs text-zinc-500">
	                            {courier.ordersCount} {courier.ordersCount === 1 ? "entrega" : "entregas"}
	                          </p>
	                        </div>
	                        <button
	                          type="button"
	                          onClick={() => setCouriers((currentCouriers) => currentCouriers.map((currentCourier) => (
	                            currentCourier.id === courier.id ? { ...currentCourier, active: !currentCourier.active } : currentCourier
	                          )))}
	                          className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
	                            courier.active
	                              ? "border border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
	                              : "border border-red-300/25 bg-red-400/10 text-red-100"
	                          }`}
	                        >
	                          {courier.active ? "Ativo" : "Inativo"}
	                        </button>
	                      </div>
	                      <div className="mt-3 flex flex-wrap gap-2">
	                        <button
	                          type="button"
	                          onClick={() => editCourier(courier)}
	                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] font-black text-white transition hover:bg-white/10"
	                        >
	                          <Edit3 size={13} />
	                          Editar
	                        </button>
	                      </div>
	                    </div>
	                  ))}
	                </div>
	              </div>
	            </details>
	          </section>
          </div>
        )}

        <MenuAdminPanel open={menuPanelOpen}>
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Integrações do cardápio
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
                  ? "Configure VITE_MENU_API_BASE_URL no admin e reinicie o servidor do Vite para liberar alterações reais do cardápio."
                  : "O admin tem URL de backend configurada, mas não conseguiu carregar o cardápio agora. Confira o console do navegador ou reinicie o servidor do Vite para recarregar o .env.local."}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ["categorias", "Categorias", menuAdmin.categories.length],
                ["produtos", "Produtos", visibleProducts.length],
                ["adicionais", "Adicionais", 0], // Força 0 para limpeza manual, mude para menuAdmin.additionals.length se quiser ver os novos
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
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descrição</span>
                    <textarea
                      value={categoryDraft.descricao}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, descricao: event.target.value })}
                      placeholder="Doces da casa"
                      className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <div className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Imagem</span>
                    <input
                      value={categoryDraft.imagem}
                      onChange={(event) => setCategoryDraft({ ...categoryDraft, imagem: event.target.value })}
                      placeholder="/Sobremesas/banner.jpeg"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                      <Upload size={14} />
                      Escolher imagem
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => readImageFile(event, (image) => setCategoryDraft((currentDraft) => ({ ...currentDraft, imagem: image })))}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Ordem</span>
                    <input
                      type="number"
	                      value={numberInputValue(categoryDraft.ordem)}
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
                    {categorySaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
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
                      Cancelar edição
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
                      Nenhuma categoria carregada do backend do cardápio.
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
                          Ordem {category.ordem} | {category.descricao || "Sem descrição"} | {category.imagem || "Sem imagem"}
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
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Selo do produto</span>
                      <input
                        value={productDraft.highlight}
                        onChange={(event) => setProductDraft({ ...productDraft, highlight: event.target.value })}
                        placeholder="Ex: Mais pedido, Da casa, Novo"
                        className="h-10 w-full rounded-lg border border-orange-300/20 bg-orange-400/[0.06] px-3 text-sm text-white outline-none placeholder:text-orange-100/35 focus:border-orange-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <p className="mt-1 text-[11px] font-bold text-orange-100/55">
                        Aparece como etiqueta laranja abaixo da descrição, igual "MAIS PEDIDO".
                      </p>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descrição</span>
                      <textarea
                        value={productDraft.descricao}
                        onChange={(event) => setProductDraft({ ...productDraft, descricao: event.target.value })}
                        placeholder="Pao, carne, queijo, bacon e salada"
                        className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Preço</span>
                        <input
                          type="number"
	                          value={numberInputValue(productDraft.preco)}
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

                    <div className="block">
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Imagem</span>
                      <input
                        value={productDraft.imagem}
                        onChange={(event) => setProductDraft({ ...productDraft, imagem: event.target.value })}
                        placeholder="https://..."
                        className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                        <Upload size={14} />
                        Escolher imagem
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => readImageFile(event, (image) => setProductDraft((currentDraft) => ({ ...currentDraft, imagem: image })))}
                        />
                      </label>
                    </div>

                    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                      Produto ativo
                      <input
                        type="checkbox"
                        checked={productDraft.ativo}
                        onChange={(event) => setProductDraft({ ...productDraft, ativo: event.target.checked })}
                        className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                      Permite adicionais
                      <input
                        type="checkbox"
                        checked={productDraft.permiteAdicionais}
                        onChange={(event) => setProductDraft({ ...productDraft, permiteAdicionais: event.target.checked })}
                        className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>

                    <div className="rounded-lg border border-white/10 bg-black/[0.24] p-3">
                      <label className="flex items-center justify-between text-xs font-black uppercase text-zinc-400">
                        Produto possui sabores?
                        <input
                          type="checkbox"
                          checked={productDraft.hasFlavors ?? false}
                          onChange={(event) => setProductDraft({
                            ...productDraft,
                            flavorIds: event.target.checked ? productDraft.flavorIds ?? [] : [],
                            hasFlavors: event.target.checked,
                          })}
                          className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </label>

                      {productDraft.hasFlavors && (
                        <div className="mt-3 space-y-3">
                          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                            Sabor obrigatório
                            <input
                              type="checkbox"
                              checked={productDraft.flavorRequired ?? true}
                              onChange={(event) => setProductDraft({ ...productDraft, flavorRequired: event.target.checked })}
                              className="h-4 w-4 accent-orange-400"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Máximo de sabores</span>
                            <input
                              min={1}
                              type="number"
                              value={productDraft.maxFlavors ?? 1}
                              onChange={(event) => setProductDraft({ ...productDraft, maxFlavors: Math.max(1, Number(event.target.value) || 1) })}
                              className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none"
                            />
                          </label>
                          <div>
                            <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Sabores disponíveis</span>
                            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/[0.18] p-2">
                              {activeFlavors.length === 0 && (
                                <span className="text-xs font-bold text-zinc-500">Cadastre sabores na tela Sabores.</span>
                              )}
                              {activeFlavors.map((flavor) => {
                                const selected = (productDraft.flavorIds ?? []).includes(flavor.id)

                                return (
                                  <button
                                    key={flavor.id}
                                    type="button"
                                    onClick={() => setProductDraft((currentDraft) => ({
                                      ...currentDraft,
                                      flavorIds: selected
                                        ? (currentDraft.flavorIds ?? []).filter((flavorId) => flavorId !== flavor.id)
                                        : [...(currentDraft.flavorIds ?? []), flavor.id],
                                    }))}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                                      selected
                                        ? "bg-orange-400 text-black"
                                        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                    }`}
                                  >
                                    {flavor.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  <button
                    type="button"
                    onClick={saveProduct}
                    disabled={productSaving || !productDraft.nome.trim() || !productDraft.categoriaId}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      {productSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {productSaving ? "Salvando..." : editingProductId ? "Salvar produto" : "Adicionar produto"}
                    </button>

                    {editingProductId && (
                      <button
                        type="button"
                        onClick={cancelProductEdit}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                      >
                        <X size={15} />
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">Produtos do site</p>
                      <p className="mt-1 text-xs text-zinc-500">Busca e categoria funcionam juntas para encontrar itens rápido.</p>
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
                        placeholder="Pesquisar por nome, descrição ou destaque"
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
                        Nenhum produto carregado do backend do cardápio.
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
                                    {product.permiteAdicionais && (
                                      <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-orange-100">
                                        Adicionais
                                      </span>
                                    )}
                                    {product.hasFlavors && (
                                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-100">
                                        Sabores {(product.flavorIds ?? []).length}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                                    {product.descricao || "Sem descrição"} | {product.imageUrl ?? product.imagem ?? "Sem imagem"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <button type="button" onClick={() => editProduct(product)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Edit3 size={14} />
                                    Editar
                                  </button>
                                  <button type="button" onClick={() => openProductAddons(product)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-orange-300/25 bg-orange-400/10 px-3 text-xs font-black text-orange-100 transition hover:bg-orange-400/[0.18] disabled:cursor-not-allowed disabled:opacity-50">
                                    <Plus size={14} />
                                    Adicionais
                                  </button>
                                  <button type="button" onClick={() => toggleProductStatus(product)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    product.ativo ? "border border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/[0.18]" : "bg-emerald-400 text-black hover:bg-emerald-300"
                                  }`}>
                                    {product.ativo ? "Desativar" : "Ativar"}
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
                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Descrição</span>
                      <textarea value={additionalDraft.descricao} onChange={(event) => setAdditionalDraft({ ...additionalDraft, descricao: event.target.value })} placeholder="Adicional de bacon crocante" className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <label className="block">
	                      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">Preço</span>
	                      <input type="number" value={numberInputValue(additionalDraft.preco)} onChange={(event) => setAdditionalDraft({ ...additionalDraft, preco: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-white/10 bg-black/[0.24] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/[0.24] px-3 py-2 text-xs font-black uppercase text-zinc-400">
                      Adicional ativo
                      <input type="checkbox" checked={additionalDraft.ativo} onChange={(event) => setAdditionalDraft({ ...additionalDraft, ativo: event.target.checked })} className="h-4 w-4 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50" />
                    </label>
                    <button type="button" onClick={saveAdditional} disabled={additionalSaving || !additionalDraft.nome.trim()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
                      {additionalSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {additionalSaving ? "Salvando..." : editingAdditionalId ? "Salvar adicional" : "Adicionar adicional"}
                    </button>
                    {editingAdditionalId && (
                      <button type="button" onClick={cancelAdditionalEdit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10">
                        <X size={15} />
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <p className="text-sm font-black text-white">Adicionais do site</p>
                  <p className="mt-1 text-xs text-zinc-500">O cliente escolhe estes adicionais ao montar o item no cardápio.</p>

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {menuAdmin.additionals.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                        Nenhum adicional carregado do backend do cardápio.
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
                          <p className="mt-1 truncate text-xs text-zinc-500">{additional.descricao || "Sem descrição"}</p>
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </MenuAdminPanel>

        {zapPanelOpen && (
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Integração WhatsApp
                </p>
                <h2 className="text-xl font-black text-white">Bot do Zap</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshWhatsAppBotStatus(true)}
                  disabled={whatsAppBotLoading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={15} className={whatsAppBotLoading ? "animate-spin" : ""} />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => showPanel("pedidos")}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                >
                  <LayoutDashboard size={15} />
                  Voltar aos pedidos
                </button>
              </div>
            </div>

            {whatsAppBotError && (
              <div className="mt-3 rounded-lg border border-red-300/25 bg-red-400/10 p-3 text-sm font-bold leading-6 text-red-100">
                {whatsAppBotError}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="space-y-4">
                <article className={`rounded-lg border p-4 ${
                  whatsAppBotStatus?.connected
                    ? "border-emerald-300/25 bg-emerald-400/10"
                    : "border-orange-300/25 bg-orange-400/[0.08]"
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Status</p>
                      <strong className={`mt-1 block text-2xl font-black ${
                        whatsAppBotStatus?.connected ? "text-emerald-100" : "text-orange-100"
                      }`}>
                        {whatsAppBotStatus?.connected ? "Conectado" : "Aguardando conexão"}
                      </strong>
                    </div>
                    <span className={`grid h-12 w-12 place-items-center rounded-lg ${
                      whatsAppBotStatus?.connected ? "bg-emerald-400 text-black" : "bg-orange-400 text-black"
                    }`}>
                      <MessageCircle size={24} />
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-zinc-300">
                    {whatsAppBotStatus?.connected
                      ? "Mensagens automáticas de pedido podem ser enviadas pelo bot."
                      : "Abra o WhatsApp no celular da loja e escaneie o QR Code quando ele aparecer."}
                  </p>
                </article>

                <div className="grid grid-cols-2 gap-3">
                  <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Fila</p>
                    <strong className="mt-2 block text-2xl font-black text-white">
                      {whatsAppBotStatus?.queuedMessages ?? 0}
                    </strong>
                  </article>
                  <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Socket</p>
                    <strong className="mt-2 block text-lg font-black text-white">
                      {whatsAppBotStatus?.hasSocket ? "Ativo" : "Parado"}
                    </strong>
                  </article>
                </div>

                <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Serviço</p>
                  <label className="mt-2 block text-xs font-black text-zinc-300" htmlFor="whatsapp-bot-url">
                    URL do bot no Render
                  </label>
                  <input
                    id="whatsapp-bot-url"
                    value={whatsAppConnectionSettings.botUrl}
                    onChange={(event) => setWhatsAppConnectionSettings((currentSettings) => ({
                      ...currentSettings,
                      botUrl: event.target.value,
                    }))}
                    placeholder="https://seu-bot.onrender.com"
                    className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-orange-300/60"
                  />
                  <label className="mt-3 block text-xs font-black text-zinc-300" htmlFor="whatsapp-admin-pin">
                    PIN administrativo do bot
                  </label>
                  <input
                    id="whatsapp-admin-pin"
                    value={whatsAppConnectionSettings.adminPin}
                    onChange={(event) => setWhatsAppConnectionSettings((currentSettings) => ({
                      ...currentSettings,
                      adminPin: event.target.value,
                    }))}
                    placeholder="Mesmo ADMIN_PIN configurado no Render"
                    className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-orange-300/60"
                  />
                  <p className="mt-1 text-[11px] font-bold leading-5 text-zinc-500">
                    Esse PIN precisa ser igual ao `ADMIN_PIN` nas variáveis de ambiente do Render. Se no Render não existir `ADMIN_PIN`, pode deixar vazio.
                  </p>
                  <button
                    type="button"
                    onClick={saveWhatsAppConnectionSettings}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                  >
                    <Save size={15} />
                    Salvar conexão
                  </button>
                </article>
                <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Teste de envio</p>
                  <h3 className="mt-1 text-lg font-black text-white">Validar mensagem</h3>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                    Usa a mesma conexão, o mesmo PIN e o mesmo WhatsApp dos pedidos.
                  </p>
                  <label className="mt-3 block text-xs font-black text-zinc-300" htmlFor="whatsapp-test-phone">
                    Telefone com DDD
                  </label>
                  <input
                    id="whatsapp-test-phone"
                    value={whatsAppTestPhone}
                    onChange={(event) => setWhatsAppTestPhone(event.target.value)}
                    placeholder="Ex: 91999999999"
                    className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-orange-300/60"
                  />
                  <button
                    type="button"
                    disabled={whatsAppTestSending}
                    onClick={() => void testWhatsAppMessage()}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MessageCircle size={15} />
                    {whatsAppTestSending ? "Enviando..." : "Enviar teste"}
                  </button>
                </article>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/[0.18] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">QR Code</p>
                    <h3 className="text-lg font-black text-white">Conectar WhatsApp da loja</h3>
                  </div>
                  <span className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11px] font-black uppercase ${
                    whatsAppBotStatus?.connected
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      : whatsAppBotStatus?.qrCodeDataUrl
                        ? "border-orange-300/25 bg-orange-400/10 text-orange-100"
                        : "border-white/10 bg-white/5 text-zinc-400"
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${
                      whatsAppBotStatus?.connected
                        ? "bg-emerald-300"
                        : whatsAppBotStatus?.qrCodeDataUrl
                          ? "bg-orange-300"
                          : "bg-zinc-500"
                    }`} />
                    {whatsAppBotStatus?.connected ? "Conectado" : whatsAppBotStatus?.qrCodeDataUrl ? "Escanear" : "Sem QR"}
                  </span>
                </div>

                <div className="mt-4 grid min-h-[360px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-4">
                  {whatsAppBotStatus?.connected ? (
                    <div className="text-center">
                      <CheckCircle2 className="mx-auto text-emerald-300" size={58} />
                      <h3 className="mt-4 text-xl font-black text-white">WhatsApp conectado</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                        O bot está pronto para mandar mensagens automáticas quando o cliente pedir e quando o status mudar.
                      </p>
                    </div>
                  ) : whatsAppBotStatus?.qrCodeDataUrl ? (
                    <div className="text-center">
                      <div className="mx-auto w-full max-w-[280px] rounded-lg bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
                        <img
                          src={whatsAppBotStatus.qrCodeDataUrl}
                          alt="QR Code do WhatsApp"
                          className="h-auto w-full"
                        />
                      </div>
                      <p className="mt-4 text-sm font-bold leading-6 text-zinc-300">
                        No celular da loja: WhatsApp Web, conectar aparelho, escanear este código.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <QrCode className="mx-auto text-zinc-500" size={58} />
                      <h3 className="mt-4 text-xl font-black text-white">QR ainda não disponível</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                        Inicie ou reinicie o bot WhatsApp. Quando ele gerar o código, esta tela atualiza sozinha.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <article className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Último QR</p>
                    <strong className="mt-1 block text-sm text-white">
                      {whatsAppBotStatus?.lastQrAt
                        ? new Date(whatsAppBotStatus.lastQrAt).toLocaleString("pt-BR")
                        : "Ainda não gerado"}
                    </strong>
                  </article>
                  <article className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Sessão</p>
                    <strong className="mt-1 block truncate text-sm text-white">
                      {whatsAppBotStatus?.sessionDir ?? "Aguardando bot"}
                    </strong>
                  </article>
                </div>
              </div>
            </div>
          </section>
        )}

        <CashPanel open={cashPanelOpen}>
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Caixa e relatórios
                </p>
                <h2 className="text-xl font-black text-white">Fechamento por período</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">De</span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(event) => setReportStartDate(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-xs font-black text-white outline-none"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">Até</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(event) => setReportEndDate(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-xs font-black text-white outline-none"
                />
                <button
                  type="button"
                  onClick={exportDailyReport}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                >
                  <Download size={15} />
                  Exportar período
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = getLocalDateInputValue()
                    setReportStartDate(today)
                    setReportEndDate(today)
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const range = getCurrentMonthRange()
                    setReportStartDate(range.start)
                    setReportEndDate(range.end)
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                >
                  Este mês
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">PIX do estabelecimento</p>
                  <label className="mt-2 block text-xs font-black text-zinc-300" htmlFor="pix-key">
                    Chave PIX enviada pelo bot
                  </label>
                  <input
                    id="pix-key"
                    value={pixSettings.pixKey ?? ""}
                    onChange={(event) => setPixSettings((currentSettings) => ({ ...currentSettings, pixKey: event.target.value }))}
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                    className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-emerald-300/60"
                  />
                </div>
                <div className="w-full xl:w-64">
                  <label className="block text-xs font-black text-zinc-300" htmlFor="pix-receiver">
                    Nome do recebedor
                  </label>
                  <input
                    id="pix-receiver"
                    value={pixSettings.pixReceiverName ?? "Pedrinho francisco ferreira araujo - stone ip S.A."}
                    onChange={(event) => setPixSettings((currentSettings) => ({ ...currentSettings, pixReceiverName: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/[0.28] px-3 text-sm font-bold text-white outline-none focus:border-emerald-300/60"
                  />
                </div>
                <button
                  type="button"
                  disabled={pixSettingsSaving}
                  onClick={() => void savePixSettings()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={15} />
                  {pixSettingsSaving ? "Salvando..." : "Salvar PIX"}
                </button>
              </div>
              {pixSettingsFeedback && (
                <p className="mt-2 text-xs font-bold text-emerald-100/80">{pixSettingsFeedback}</p>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-lg border border-emerald-300/20 bg-emerald-400/[0.08] p-3">
                <p className="text-[10px] font-black uppercase text-emerald-100/70">Entrou finalizado</p>
                <strong className="mt-2 block text-2xl font-black text-emerald-100">{formatCurrency(completedRevenue)}</strong>
              </article>
              <article className="rounded-lg border border-orange-300/20 bg-orange-400/[0.08] p-3">
                <p className="text-[10px] font-black uppercase text-orange-100/70">Em aberto</p>
                <strong className="mt-2 block text-2xl font-black text-orange-100">{formatCurrency(openRevenue)}</strong>
              </article>
              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <p className="text-[10px] font-black uppercase text-zinc-500">Pedidos no período</p>
                <strong className="mt-2 block text-2xl font-black text-white">{reportOrders.length}</strong>
              </article>
              <article className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                <p className="text-[10px] font-black uppercase text-zinc-500">Ticket médio</p>
                <strong className="mt-2 block text-2xl font-black text-white">{formatCurrency(averageTicket)}</strong>
              </article>
            </div>

	            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
	              {[
	                ["Pix", paymentSummary.pix],
                ["Dinheiro", paymentSummary.dinheiro],
                ["Cartão", paymentSummary.cartao],
                ["Outros", paymentSummary.outros],
              ].map(([label, value]) => (
                <article key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] font-black uppercase text-zinc-500">{label}</p>
                  <strong className="mt-1 block text-lg font-black text-white">{formatCurrency(Number(value))}</strong>
                </article>
	              ))}
	            </div>

            <details className="mt-4 rounded-lg border border-white/10 bg-black/[0.14] p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-white">
                <span>Entregas e motoboys</span>
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400">
                  {reportDeliveryOrders.length} entregas
                </span>
              </summary>

              <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Motoboys</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={courierDraft.name}
                      onChange={(event) => setCourierDraft({ ...courierDraft, name: event.target.value })}
                      placeholder="Nome"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/[0.28] px-3 text-xs font-bold text-white outline-none placeholder:text-zinc-500 focus:border-orange-300/60"
                    />
                    <button
                      type="button"
                      onClick={addCourier}
                      className="h-9 rounded-lg bg-orange-400 px-3 text-xs font-black text-black transition hover:bg-orange-300"
                    >
                      {editingCourierId ? "Salvar" : "Add"}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {couriers.length === 0 && (
                      <span className="text-xs font-bold text-zinc-500">Nenhum motoboy cadastrado.</span>
                    )}
                    {couriers.map((courier) => (
                      <button
                        key={courier.id}
                        type="button"
                        onClick={() => setCouriers((currentCouriers) => currentCouriers.map((currentCourier) => (
                          currentCourier.id === courier.id ? { ...currentCourier, active: !currentCourier.active } : currentCourier
                        )))}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-black transition ${
                          courier.active
                            ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                            : "border-red-300/25 bg-red-400/10 text-red-100"
                        }`}
                        title="Clique para ativar ou pausar"
                      >
                        {courier.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">Pedidos delivery</p>
                    <span className="text-[11px] font-bold text-zinc-500">{reportPeriodLabel}</span>
                  </div>

                  <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                    {reportDeliveryOrders.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-black/[0.18] p-4 text-center text-xs font-bold text-zinc-500">
                        Nenhuma entrega para selecionar motoboy.
                      </div>
                    )}

                    {reportDeliveryOrders.map((order) => (
                      <div key={`courier-${order.id}`} className="grid gap-2 rounded-lg border border-white/10 bg-black/[0.18] p-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-black text-white">#{order.id} {order.customer}</strong>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">{order.address || "Sem endereço"}</p>
                        </div>
                        <select
                          value={order.courierId ?? ""}
                          onChange={(event) => void assignCourierToOrder(order, event.target.value)}
                          className="h-9 rounded-lg border border-white/10 bg-black/[0.28] px-2 text-xs font-black text-white outline-none focus:border-orange-300/60"
                        >
                          <option value="">Sem motoboy</option>
                          {activeCouriers.map((courier) => (
                            <option key={courier.id} value={courier.id}>
                              {courier.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>

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
                    <p className="mt-1 text-xs text-zinc-500">Produtos mais vendidos no período selecionado.</p>
                  </div>
                  <span className="text-xs font-black text-orange-200">{visibleCashItems.reduce((total, item) => total + item.quantity, 0)} unidades</span>
                </div>

                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {visibleCashItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-6 text-center text-sm font-bold text-zinc-500">
                      Nenhuma saída encontrada nessa aba.
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
                      Nenhum pedido encontrado para este período.
                    </div>
                  )}

                  {reportOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-black text-white">Pedido #{order.id}</strong>
	                        <span className="text-xs font-black text-orange-200">{formatCurrency(calculateOrderTotal(order))}</span>
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
        </CashPanel>

        <ClientsPanel open={clientsPanelOpen}>
          <section className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.92)] p-4">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
                  Clientes
                </p>
	                <h2 className="text-xl font-black text-white">Histórico e recorrência</h2>
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
	                  <h3 className="mt-4 text-lg font-black text-white">Ainda não há clientes no painel</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Quando os pedidos chegarem, o histórico por telefone aparece aqui automaticamente.
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
                          Endereços salvos
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedClient.addresses.length === 0 && (
                            <p className="text-sm font-bold text-zinc-500">Nenhum endereço salvo.</p>
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
                          Observações internas
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
	                      <p className="text-sm font-black text-white">Histórico de pedidos</p>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {selectedClient.orders.map((order) => (
                          <div key={`${selectedClient.key}-${order.id}`} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/[0.18] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <strong className="text-sm font-black text-white">Pedido #{order.id}</strong>
                              <p className="mt-1 text-xs text-zinc-500">{order.time} | {order.delivery} | {order.payment}</p>
                            </div>
	                            <span className="text-xs font-black text-orange-200">{formatCurrency(calculateOrderTotal(order))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </ClientsPanel>

        {showingOrdersPanel && (
        <main className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)_560px] 2xl:grid-cols-[240px_minmax(0,1fr)_620px]">
          <OrderFilters
            activeFilter={activeFilter}
            filters={filters}
            hideFinished={hideFinished}
            onClear={() => {
              setActiveFilter("todos")
              setActiveStatusFilter("todos")
              setSearch("")
              showNotice("Mostrando todos os pedidos.")
            }}
            onFilterChange={(value, label) => {
              setActiveFilter(value as OrderFilter)
              setActiveStatusFilter("todos")
              showNotice(`Filtro aplicado: ${label}.`)
            }}
            setHideFinished={setHideFinished}
          />

          <OrderList
            activeSelectedOrderId={activeSelectedOrderId}
            activeWindowHours={activeOrdersWindowHours}
            connectionStatus={connectionStatus}
            highlightedOrderIds={orderSound.unacknowledgedOrderIds}
            isSyncing={isSyncing}
            onSelectOrder={selectOrder}
	            orders={visibleOrdersWithTotals}
            search={search}
            setSearch={setSearch}
          />

          <OrderDetails>
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
                  <div className="mt-5 space-y-3">
                    <div className={`overflow-hidden rounded-lg border ${
                      selectedOrder.status === "cancelado"
                        ? "border-red-300/30 bg-red-500/[0.08]"
                        : selectedOrder.status === "finalizado" || selectedOrder.status === "concluido"
                          ? "border-emerald-300/30 bg-emerald-500/[0.08]"
                          : "border-orange-300/25 bg-orange-400/[0.08]"
                    }`}>
                      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_190px]">
                        <div className="min-w-0 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-orange-400 px-3 py-1 text-xs font-black uppercase text-black">
                              Pedido #{selectedOrder.id}
                            </span>
                            <span className="rounded-lg border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-white">
                              {statusLabels[selectedOrder.status] ?? selectedOrder.status}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-400 px-4 text-sm font-black text-black transition hover:bg-orange-300"
                                >
                                  <Save size={15} />
                                  Salvar edição
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditing(false)
                                    setDraft(null)
                                    showNotice(`Edição do pedido #${selectedOrder.id} cancelada.`)
                                  }}
                                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
                                >
                                  <X size={15} />
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                {selectedOrder.status === "novo" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={() => updateSelectedOrder(
                                      { status: "preparando" },
                                      `Pedido #${selectedOrder.id} aprovado e enviado para preparo.`
                                    )}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Check size={15} />
                                    {selectedOrderIsUpdating ? "Salvando..." : "Aprovar e preparar"}
                                  </button>
                                )}
                                {selectedOrder.status === "aprovado" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={() => updateSelectedOrder({ status: "preparando" }, `Pedido #${selectedOrder.id} enviado para preparo.`)}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <PackageCheck size={15} />
                                    {selectedOrderIsUpdating ? "Salvando..." : "Iniciar preparo"}
                                  </button>
                                )}
                                {selectedOrder.status === "preparando" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating || (selectedOrder.delivery === "Delivery" && !selectedOrder.courierId)}
                                    onClick={() => {
                                      const nextStatus = selectedOrder.delivery === "Delivery"
                                        ? "saiu"
                                        : selectedOrder.delivery === "Mesa"
                                          ? "concluido"
                                          : "pronto"

                                      return updateSelectedOrder(
                                        { status: nextStatus },
                                        selectedOrder.delivery === "Delivery"
                                          ? `Pedido #${selectedOrder.id} saiu para entrega.`
                                          : selectedOrder.delivery === "Mesa"
                                            ? `Pedido #${selectedOrder.id} concluído na mesa.`
                                            : `Pedido #${selectedOrder.id} marcado como pronto para retirada.`
                                      )
                                    }}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {selectedOrder.delivery === "Delivery" ? <Truck size={15} /> : <CheckCircle2 size={15} />}
                                    {selectedOrderIsUpdating
                                      ? "Salvando..."
                                      : selectedOrder.delivery === "Delivery" && !selectedOrder.courierId
                                        ? "Selecione um motoboy"
                                        : selectedOrder.delivery === "Delivery"
                                          ? "Enviar para entrega"
                                          : selectedOrder.delivery === "Mesa"
                                            ? "Concluir mesa"
                                            : "Marcar pronto"}
                                  </button>
                                )}
                                {selectedOrder.status === "pronto" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={() => updateSelectedOrder({ status: "finalizado" }, `Pedido #${selectedOrder.id} finalizado.`)}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={15} />
                                    {selectedOrderIsUpdating ? "Salvando..." : "Finalizar pedido"}
                                  </button>
                                )}
                                {selectedOrder.status === "saiu" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
	                                    onClick={() => updateSelectedOrder({ status: "finalizado" }, `Pedido #${selectedOrder.id} finalizado.`)}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={15} />
                                    {selectedOrderIsUpdating ? "Salvando..." : "Finalizar pedido"}
                                  </button>
                                )}
                                {selectedOrder.status === "concluido" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={() => updateSelectedOrder({ status: "finalizado" }, `Pedido #${selectedOrder.id} finalizado.`)}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={15} />
                                    {selectedOrderIsUpdating ? "Salvando..." : "Finalizar pedido"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Reimprimir comanda"
                                  aria-label="Reimprimir comanda"
                                  onClick={() => void printApprovalTickets(selectedOrder, { copies: localPanelSettings.printCopies }).then(
                                    () => showStatusToast("Comanda enviada"),
                                    (error) => showNotice(error instanceof Error ? error.message : "Não foi possível reimprimir a comanda.")
                                  )}
                                  className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                                >
                                  <Printer size={18} />
                                </button>
                                {selectedOrder.status !== "cancelado" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={startEdit}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Edit3 size={15} />
                                    Editar
                                  </button>
                                )}
                                {selectedOrder.status === "cancelado" && (
                                  <button
                                    type="button"
                                    disabled={selectedOrderIsUpdating}
                                    onClick={restoreSelectedOrder}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-400 px-4 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <RefreshCw size={15} />
                                    {selectedOrderIsUpdating ? "Restaurando..." : "Restaurar pedido"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <h3 className="mt-4 break-words text-3xl font-black leading-none text-white">
                            {selectedOrder.customer}
                          </h3>
	                          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
	                            <div className={`rounded-lg border px-3 py-3 text-center ${deliveryHighlightStyles[selectedOrder.delivery]}`}>
	                              <p className="text-[10px] font-black uppercase text-zinc-500">Tipo do pedido</p>
	                              <strong className="mt-1 block whitespace-normal text-xl font-black uppercase leading-tight">{selectedOrder.delivery}</strong>
	                            </div>
	                            <div className="rounded-lg bg-black/20 px-3 py-3 text-center">
	                              <p className="text-[10px] font-black uppercase text-zinc-500">Itens</p>
	                              <strong className="mt-1 block text-xl font-black text-white">{selectedOrder.items.length}</strong>
	                            </div>
	                          </div>
	                          {selectedOrder.status === "cancelado" && selectedOrder.cancelReason && (
                            <p className="mt-3 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-100">
                              Motivo do cancelamento: {selectedOrder.cancelReason}
                            </p>
                          )}
                        </div>
                        <div className="border-t border-white/10 bg-black/25 p-4 lg:border-l lg:border-t-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Total</p>
                          <strong className="mt-2 block text-3xl font-black leading-none text-emerald-100">
	                            {formatCurrency(calculateOrderTotal(selectedOrder))}
                          </strong>
                          <p className="mt-3 break-words text-xs font-bold text-zinc-400">{selectedOrder.payment}</p>
                        </div>
                      </div>
                    </div>

                    {(selectedOrder.status === "concluido" || selectedOrder.status === "finalizado" || selectedOrder.status === "cancelado") && (
                      <div
                        className={`rounded-lg border p-3 ${
                          selectedOrder.status === "cancelado"
                            ? "border-red-300/35 bg-red-400/10 text-red-100"
                            : "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em]">
	                          {selectedOrder.status === "cancelado" ? "Pedido cancelado" : selectedOrder.status === "finalizado" ? "Pedido finalizado" : "Pedido concluído"}
                        </p>
                        <p className="mt-1 text-sm leading-5 opacity-80">
                          {selectedOrder.status === "cancelado"
                            ? "Este pedido saiu da fila ativa. Use restaurar pedido se isso aconteceu por engano."
                            : "Este pedido está encerrado operacionalmente."}
                        </p>
                      </div>
                    )}

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                          <div className="flex items-center gap-2 text-orange-300">
                            <User size={15} />
                            <p className="text-[10px] font-black uppercase tracking-[0.12em]">Cliente</p>
                          </div>
                          <strong className="mt-2 block break-words text-base text-white">{selectedOrder.customer}</strong>
                          <p className="mt-1 break-words text-sm font-bold text-zinc-400">{selectedOrder.phone}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                          <div className="flex items-center gap-2 text-orange-300">
                            <SelectedDeliveryIcon size={15} />
                            <p className="text-[10px] font-black uppercase tracking-[0.12em]">Tipo</p>
                          </div>
	                          <strong className="mt-2 block text-base text-white">{selectedOrder.delivery}</strong>
	                          <p className="mt-1 break-words text-sm font-bold text-zinc-400">{selectedOrder.address}</p>
	                          {selectedOrder.delivery === "Delivery" && (
                              <div className="mt-2 rounded-lg border border-orange-300/20 bg-orange-400/10 p-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-orange-100/70" htmlFor="selected-order-courier">
                                  Entregador
                                </label>
                                <select
                                  id="selected-order-courier"
                                  value={selectedOrder.courierId ?? ""}
                                  onChange={(event) => void assignCourierToOrder(selectedOrder, event.target.value)}
                                  disabled={selectedOrderIsUpdating}
                                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/[0.28] px-2 text-xs font-black text-white outline-none focus:border-orange-300/60 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <option value="">Selecione um motoboy</option>
                                  {activeCouriers.map((courier) => (
                                    <option key={courier.id} value={courier.id}>
                                      {courier.name}
                                    </option>
                                  ))}
                                </select>
                                {activeCouriers.length === 0 && (
                                  <p className="mt-2 text-[11px] font-bold text-orange-100/70">
                                    Cadastre um motoboy no caixa para liberar a entrega.
                                  </p>
                                )}
                                {!selectedOrder.courierId && activeCouriers.length > 0 && (
                                  <p className="mt-2 text-[11px] font-bold text-orange-100/80">
                                    Selecione um motoboy antes de enviar para entrega.
                                  </p>
                                )}
                              </div>
	                          )}
	                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
                          <div className="flex items-center gap-2 text-orange-300">
                            <DollarSign size={15} />
                            <p className="text-[10px] font-black uppercase tracking-[0.12em]">Conta</p>
                          </div>
	                          <strong className="mt-2 block text-base text-white">{selectedOrder.payment}</strong>
	                          <p className="mt-1 break-words text-sm font-bold text-zinc-400">
	                            Sub {formatCurrency(selectedOrder.subtotal ?? selectedOrder.total)}
	                          </p>
	                          {selectedOrder.payment === "Dinheiro" && selectedOrder.needsChange && (
	                            <p className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-100">
	                              Troco para {formatCurrency(selectedOrder.changeFor ?? 0)}
	                            </p>
	                          )}
	                        </div>
                      </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                      <div className="rounded-lg border border-white/10 bg-[#100b08] p-4">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Itens do pedido</p>
                            <h3 className="mt-1 text-xl font-black text-white">{selectedOrder.items.length} {selectedOrder.items.length === 1 ? "item" : "itens"}</h3>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {selectedOrder.items.map((item, index) => {
                            const itemDetail = parseOrderItemDetail(item)

                            return (
                              <div key={`${index}-${item}`} className="rounded-lg border border-white/10 bg-black/25 p-3">
                                <div className="flex items-start gap-3">
                                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-orange-400 text-base font-black text-black">
                                    {itemDetail.quantity}x
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <strong className="block text-lg font-black leading-6 text-white">{itemDetail.name}</strong>
                                    {itemDetail.additions.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {itemDetail.additions.map((addition) => (
                                          <span key={addition} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                                            + {addition}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {itemDetail.note && (
                                      <div className="mt-3 rounded-lg border-l-4 border-orange-300 bg-orange-400/10 px-3 py-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-orange-200">Observação do item</p>
                                        <p className="mt-1 text-sm font-semibold leading-5 text-white">{itemDetail.note}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-[#100b08] p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-300">Resumo</p>
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
                              <span className="font-bold text-zinc-500">Subtotal</span>
	                              <strong className="text-white">{formatCurrency(selectedOrder.subtotal ?? selectedOrder.total)}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
                              <span className="font-bold text-zinc-500">Entrega</span>
                              <strong className="text-white">{formatCurrency(selectedOrder.deliveryFee ?? 0)}</strong>
                            </div>
                            {(selectedOrder.discount || selectedOrder.discountPercent) && (
                              <div className="flex items-center justify-between gap-2 border-b border-orange-300/20 py-2 text-sm">
                                <span className="font-bold text-orange-200">Desconto</span>
                                <strong className="text-white">
                                  {selectedOrder.discountPercent
                                    ? `${selectedOrder.discountPercent}%`
                                    : formatCurrency(selectedOrder.discount ?? 0)}
                                </strong>
                              </div>
                            )}
                            <div className="rounded-lg bg-emerald-400/10 p-3">
                              <p className="text-[10px] font-black uppercase text-emerald-100/70">Total final</p>
	                              <strong className="mt-1 block text-2xl text-emerald-100">{formatCurrency(calculateOrderTotal(selectedOrder))}</strong>
                            </div>
                        </div>
                      </div>
                    </div>

                    {!isEditing && selectedOrder.status !== "cancelado" && selectedOrder.status !== "finalizado" && (
                      <div className="rounded-lg border border-red-300/20 bg-red-400/[0.06] p-3">
                        {!isCanceling ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold text-red-100/60">
                              Área de cancelamento
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelReason(cancelReasons[0])
                                setIsCanceling(true)
                                showNotice(`Escolha o motivo para cancelar o pedido #${selectedOrder.id}.`)
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
                                  showNotice(`Cancelamento do pedido #${selectedOrder.id} fechado.`)
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
              </OrderDetails>
        </main>
        )}
      </div>
    </MainLayout>
  )
}
