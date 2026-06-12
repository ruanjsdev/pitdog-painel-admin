import { AdminApiError, adminApiBaseUrl, adminRequest } from "./admin-api"
import type { DeliveryPerson, DeliveryPersonDraft } from "../types/delivery"

const resourceUnavailableMessage = "Recurso ainda não disponível na API."

function asArray<T>(response: T[] | { content?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.content)) return response.content
  if (Array.isArray(response?.data)) return response.data

  return []
}

function mapDeliveryPerson(person: Partial<DeliveryPerson> & { ativo?: boolean; nome?: string; observacao?: string; telefone?: string }): DeliveryPerson {
  return {
    active: person.active ?? person.ativo ?? true,
    id: String(person.id ?? `delivery-${Date.now()}`),
    name: person.name ?? person.nome ?? "Entregador",
    notes: person.notes ?? person.observacao,
    phone: person.phone ?? person.telefone,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  }
}

function toBackendDraft(draft: DeliveryPersonDraft) {
  return {
    active: draft.active,
    ativo: draft.active,
    name: draft.name,
    nome: draft.name,
    notes: draft.notes,
    observacao: draft.notes,
    phone: draft.phone,
    telefone: draft.phone,
  }
}

function normalizeResourceError(error: unknown) {
  if (error instanceof AdminApiError && (error.status === 403 || error.status === 404 || error.status === 501)) {
    throw new Error(resourceUnavailableMessage)
  }

  throw error
}

export const deliveryApi = {
  async listDeliveryPeople() {
    if (!adminApiBaseUrl) return []

    try {
      return asArray(await adminRequest<DeliveryPerson[] | { content?: DeliveryPerson[] } | { data?: DeliveryPerson[] }>("/delivery-people", undefined, { expireSessionOnAuthError: false })).map(mapDeliveryPerson)
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async createDeliveryPerson(data: DeliveryPersonDraft) {
    try {
      return mapDeliveryPerson(await adminRequest<DeliveryPerson>("/delivery-people", {
        body: JSON.stringify(toBackendDraft(data)),
        method: "POST",
      }, { expireSessionOnAuthError: false }))
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async updateDeliveryPerson(id: string, data: DeliveryPersonDraft) {
    try {
      return mapDeliveryPerson(await adminRequest<DeliveryPerson>(`/delivery-people/${id}`, {
        body: JSON.stringify(toBackendDraft(data)),
        method: "PUT",
      }, { expireSessionOnAuthError: false }))
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async deleteDeliveryPerson(id: string) {
    try {
      await adminRequest<void>(`/delivery-people/${id}`, {
        method: "DELETE",
      }, { expireSessionOnAuthError: false })
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async assignDeliveryPersonToOrder(orderId: number, deliveryPersonId: string) {
    try {
      await adminRequest<void>(`/orders/${orderId}/delivery-person`, {
        body: JSON.stringify({ deliveryPersonId }),
        method: "PATCH",
      }, { expireSessionOnAuthError: false })
    } catch (error) {
      normalizeResourceError(error)
    }
  },
}
