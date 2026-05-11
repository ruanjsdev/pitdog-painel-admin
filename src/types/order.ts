export type OrderStatus = "novo" | "preparando" | "saiu" | "cancelado" | "concluido"

export type DeliveryType = "Delivery" | "Mesa" | "Retirada"

export type Order = {
  id: number
  customer: string
  phone: string
  address: string
  time: string
  total: number
  payment: string
  delivery: DeliveryType
  status: OrderStatus
  items: string[]
  cancelReason?: string
  notes?: string
}
