export type DeliveryPerson = {
  id: string
  name: string
  phone?: string
  active: boolean
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type DeliveryPersonDraft = Omit<DeliveryPerson, "createdAt" | "id" | "updatedAt">
