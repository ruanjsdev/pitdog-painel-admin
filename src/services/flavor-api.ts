import { AdminApiError, adminApiBaseUrl, adminRequest } from "./admin-api"
import type { ProductFlavor, ProductFlavorDraft } from "../types/menu"

const resourceUnavailableMessage = "Recurso ainda não disponível na API."

function asArray<T>(response: T[] | { content?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.content)) return response.content
  if (Array.isArray(response?.data)) return response.data

  return []
}

function mapFlavor(flavor: Partial<ProductFlavor> & { ativo?: boolean; nome?: string; observacao?: string }): ProductFlavor {
  return {
    active: flavor.active ?? flavor.ativo ?? true,
    categoryId: flavor.categoryId ? String(flavor.categoryId) : undefined,
    createdAt: flavor.createdAt,
    id: String(flavor.id ?? `flavor-${Date.now()}`),
    name: flavor.name ?? flavor.nome ?? "Sabor",
    notes: flavor.notes ?? flavor.observacao,
    productId: flavor.productId ? String(flavor.productId) : undefined,
    updatedAt: flavor.updatedAt,
  }
}

function toBackendDraft(draft: ProductFlavorDraft) {
  return {
    active: draft.active,
    ativo: draft.active,
    categoryId: draft.categoryId,
    name: draft.name,
    nome: draft.name,
    notes: draft.notes,
    observacao: draft.notes,
    productId: draft.productId,
  }
}

function normalizeResourceError(error: unknown) {
  if (error instanceof AdminApiError && (error.status === 403 || error.status === 404 || error.status === 501)) {
    throw new Error(resourceUnavailableMessage)
  }

  throw error
}

export const flavorApi = {
  async listFlavors() {
    if (!adminApiBaseUrl) return []

    try {
      return asArray(await adminRequest<ProductFlavor[] | { content?: ProductFlavor[] } | { data?: ProductFlavor[] }>("/flavors", undefined, { expireSessionOnAuthError: false })).map(mapFlavor)
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async createFlavor(data: ProductFlavorDraft) {
    try {
      return mapFlavor(await adminRequest<ProductFlavor>("/flavors", {
        body: JSON.stringify(toBackendDraft(data)),
        method: "POST",
      }, { expireSessionOnAuthError: false }))
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async updateFlavor(id: string, data: ProductFlavorDraft) {
    try {
      return mapFlavor(await adminRequest<ProductFlavor>(`/flavors/${id}`, {
        body: JSON.stringify(toBackendDraft(data)),
        method: "PUT",
      }, { expireSessionOnAuthError: false }))
    } catch (error) {
      normalizeResourceError(error)
    }
  },

  async deleteFlavor(id: string) {
    try {
      await adminRequest<void>(`/flavors/${id}`, {
        method: "DELETE",
      }, { expireSessionOnAuthError: false })
    } catch (error) {
      normalizeResourceError(error)
    }
  },
}
