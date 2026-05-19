export type OrderStatus = "novo" | "preparando" | "saiu" | "cancelado" | "concluido"

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
  discount?: number
  discountPercent?: number
  discountReason?: string
  payment: string
  delivery: DeliveryType
  status: OrderStatus
  items: string[]
  cancelReason?: string
  notes?: string
  backendStatus?: string
}
