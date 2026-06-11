export type OrderStatus =
  | "novo"
  | "aprovado"
  | "preparando"
  | "pronto"
  | "saiu"
  | "cancelado"
  | "concluido"
  | "finalizado"

export type PaymentStatus = "PENDENTE" | "CONFIRMADO" | "CANCELADO"

export type DeliveryType = "Delivery" | "Mesa" | "Retirada"

export type Order = {
  id: number
  backendId?: number
  customer: string
  phone: string
  address: string
  time: string
  createdAt?: string
  createdAtTimestamp?: number
  total: number
  subtotal?: number
  deliveryFee?: number
  courierId?: string
  courierName?: string
  deliveryPersonId?: string
  deliveryPersonName?: string
  discount?: number
  discountPercent?: number
  discountReason?: string
  needsChange?: boolean
  changeFor?: number
  paymentStatus?: PaymentStatus
  paymentConfirmed?: boolean
  paymentConfirmedAt?: string
  paymentChangeFor?: number
  paymentChangeValue?: number
  backendPaymentMethod?: string
  payment: string
  delivery: DeliveryType
  status: OrderStatus
  items: string[]
  addonNames?: string[]
  addons?: Array<{
    active?: boolean
    id: string
    name: string
    price?: number
  }>
  flavorId?: string
  flavorIds?: string[]
  flavorName?: string
  flavorNames?: string[]
  cancelReason?: string
  notes?: string
  backendStatus?: string
}
