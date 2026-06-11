import { AdminApiError, adminApiBaseUrl, adminRequest } from "./admin-api"
import type { Addon, MenuAdditionalDraft } from "../types/menu"

const unsupportedMessage = "A API ainda não possui suporte para vínculo de adicionais por produto."

type ApiAddon = Partial<Addon> & {
  active?: boolean
  ativo?: boolean
  createdAt?: string
  description?: string
  descricao?: string
  id?: number | string
  name?: string
  nome?: string
  nomeAdicional?: string
  nomedAicional?: string
  preco?: number
  price?: number
  updatedAt?: string
}

function asArray<T>(response: T[] | { content?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.content)) return response.content
  if (Array.isArray(response?.data)) return response.data

  return []
}

function normalizeApiError(error: unknown) {
  if (error instanceof AdminApiError && (error.status === 404 || error.status === 501)) {
    throw new Error(unsupportedMessage)
  }

  throw error
}

function mapAddon(addon: ApiAddon): Addon {
  return {
    active: addon.active ?? addon.ativo ?? true,
    description: addon.description ?? addon.descricao,
    id: String(addon.id ?? `addon-${Date.now()}`),
    name: addon.name ?? addon.nome ?? addon.nomeAdicional ?? addon.nomedAicional ?? "Adicional",
    price: Number(addon.price ?? addon.preco ?? 0),
    createdAt: addon.createdAt,
    updatedAt: addon.updatedAt,
  }
}

function toBackendAddon(addon: MenuAdditionalDraft) {
  return {
    active: addon.ativo,
    ativo: addon.ativo,
    description: addon.descricao,
    descricao: addon.descricao,
    name: addon.nome,
    nome: addon.nome,
    nomeAdicional: addon.nome,
    price: addon.preco,
    preco: addon.preco,
  }
}

export const addonsApi = {
  async listAddons() {
    if (!adminApiBaseUrl) return []

    try {
      return asArray(await adminRequest<ApiAddon[] | { content?: ApiAddon[] } | { data?: ApiAddon[] }>("/addons")).map(mapAddon)
    } catch (error) {
      normalizeApiError(error)
    }
  },

  async createAddon(data: MenuAdditionalDraft) {
    try {
      return mapAddon(await adminRequest<ApiAddon>("/addons", {
        body: JSON.stringify(toBackendAddon(data)),
        method: "POST",
      }))
    } catch (error) {
      normalizeApiError(error)
    }
  },

  async updateAddon(id: string, data: MenuAdditionalDraft) {
    try {
      return mapAddon(await adminRequest<ApiAddon>(`/addons/${id}`, {
        body: JSON.stringify(toBackendAddon(data)),
        method: "PUT",
      }))
    } catch (error) {
      normalizeApiError(error)
    }
  },

  async deleteAddon(id: string) {
    try {
      await adminRequest<void>(`/addons/${id}`, {
        method: "DELETE",
      })
    } catch (error) {
      normalizeApiError(error)
    }
  },

  async listProductAddons(productId: string) {
    if (!adminApiBaseUrl) return []

    try {
      return asArray(await adminRequest<ApiAddon[] | { content?: ApiAddon[] } | { data?: ApiAddon[] }>(`/products/${productId}/addons`)).map(mapAddon)
    } catch (error) {
      normalizeApiError(error)
    }
  },

  async updateProductAddons(productId: string, addonIds: string[]) {
    try {
      await adminRequest<void>(`/products/${productId}/addons`, {
        body: JSON.stringify({ addonIds }),
        method: "PUT",
      })
    } catch (error) {
      normalizeApiError(error)
    }
  },
}
