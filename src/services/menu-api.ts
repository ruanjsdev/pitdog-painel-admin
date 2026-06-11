import type {
  MenuAdditional,
  MenuAdditionalDraft,
  MenuCategory,
  MenuCategoryDraft,
  MenuProduct,
  MenuProductDraft,
} from "../types/menu"
import { adminApiBaseUrl, adminRequest } from "./admin-api"

export const hasMenuBackend = Boolean(adminApiBaseUrl)

const defaultCategoryImageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
const productsAdminPath = "/admin/produtos"
const subtitleMarkerPrefix = "@@PITS_SUBTITLE:"
const subtitleMarkerSuffix = "@@"
const invisibleSubtitlePrefix = "\u2063pits-subtitle:"
const invisibleSubtitleSuffix = "\u2063"

type BackendCategory = Omit<MenuCategory, "imagem" | "imageUrl"> & {
  imagemUrl?: string | null
}

type BackendProduct = Omit<MenuProduct, "imagem" | "imageUrl"> & {
  categoriaNome?: string
  destaque?: boolean
  imagemUrl?: string | null
  permiteAdicionais?: boolean
  subtitulo?: string | null
}

type BackendAdditional = {
  id: number
  nomedAicional?: string
  nomeAdicional?: string
  nome?: string
  preco: number
  ativo: boolean
}

function asArray<T>(response: T[] | { content?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.content)) return response.content
  if (Array.isArray(response?.data)) return response.data

  return []
}

async function listWithPublicFallback<T>(adminPath: string, publicPath: string) {
  try {
    const adminItems = asArray(await adminRequest<T[] | { content?: T[] } | { data?: T[] }>(adminPath))

    if (adminItems.length > 0) return adminItems
  } catch (error) {
    console.warn(`[menu-api] Falha ao listar ${adminPath}; tentando ${publicPath}.`, error)
  }

  return asArray(await adminRequest<T[] | { content?: T[] } | { data?: T[] }>(publicPath, undefined, { auth: false }))
}

function mapCategory(category: BackendCategory): MenuCategory {
  return {
    ...category,
    id: Number(category.id),
    ordem: Number(category.ordem ?? 0),
    imageUrl: category.imagemUrl ?? null,
    imagem: category.imagemUrl ?? null,
  }
}

function readProductDescription(rawDescription = "") {
  const invisibleMarkerStart = rawDescription.lastIndexOf(invisibleSubtitlePrefix)

  if (invisibleMarkerStart !== -1) {
    const invisibleMarkerEnd = rawDescription.indexOf(
      invisibleSubtitleSuffix,
      invisibleMarkerStart + invisibleSubtitlePrefix.length
    )

    if (invisibleMarkerEnd !== -1) {
      const encodedSubtitle = rawDescription.slice(
        invisibleMarkerStart + invisibleSubtitlePrefix.length,
        invisibleMarkerEnd
      )
      const description = rawDescription.slice(0, invisibleMarkerStart).trimEnd()

      try {
        return {
          description,
          subtitle: decodeURIComponent(encodedSubtitle),
        }
      } catch {
        return {
          description,
          subtitle: "",
        }
      }
    }
  }

  const normalizedDescription = rawDescription.toLowerCase()
  const markerStart = normalizedDescription.lastIndexOf(subtitleMarkerPrefix.toLowerCase())

  if (markerStart === -1) {
    return {
      description: rawDescription,
      subtitle: "",
    }
  }

  const markerEnd = rawDescription.indexOf(subtitleMarkerSuffix, markerStart + subtitleMarkerPrefix.length)

  if (markerEnd === -1) {
    return {
      description: rawDescription,
      subtitle: "",
    }
  }

  const encodedSubtitle = rawDescription.slice(markerStart + subtitleMarkerPrefix.length, markerEnd)
  const description = rawDescription.slice(0, markerStart).trimEnd()

  try {
    return {
      description,
      subtitle: decodeURIComponent(encodedSubtitle),
    }
  } catch {
    return {
      description,
      subtitle: "",
    }
  }
}

function writeProductDescription(description: string, subtitle: string) {
  const cleanDescription = readProductDescription(description).description.trim()
  const cleanSubtitle = subtitle.trim()

  if (!cleanSubtitle) return cleanDescription

  return `${cleanDescription}${invisibleSubtitlePrefix}${encodeURIComponent(cleanSubtitle)}${invisibleSubtitleSuffix}`
}

function mapProduct(product: BackendProduct): MenuProduct {
  const decodedDescription = readProductDescription(product.descricao)
  const highlight = product.highlight ?? product.subtitle ?? product.subtitulo ?? decodedDescription.subtitle ?? null

  return {
    ...product,
    id: Number(product.id),
    categoriaId: Number(product.categoriaId),
    preco: Number(product.preco ?? 0),
    descricao: decodedDescription.description,
    highlight,
    destaque: Boolean(product.destaque) || Boolean(highlight),
    permiteAdicionais: product.permiteAdicionais ?? false,
    subtitle: product.subtitle ?? highlight,
    imageUrl: product.imagemUrl ?? null,
    imagem: product.imagemUrl ?? null,
  }
}

function mapAdditional(additional: BackendAdditional): MenuAdditional {
  return {
    ativo: additional.ativo,
    descricao: "",
    id: Number(additional.id),
    nome: additional.nomeAdicional ?? additional.nomedAicional ?? additional.nome ?? "Adicional",
    preco: additional.preco,
  }
}

export const menuApi = {
  async listCategories() {
    if (!adminApiBaseUrl) return []

    return asArray(await adminRequest<BackendCategory[] | { content?: BackendCategory[] } | { data?: BackendCategory[] }>("/admin/categorias")).map(mapCategory)
  },

  async createCategory(category: MenuCategoryDraft) {
    return mapCategory(await adminRequest<BackendCategory>("/admin/categorias", {
      body: JSON.stringify({
        ativo: category.ativo,
        descricao: category.descricao,
        imagemUrl: category.imagem.trim() || defaultCategoryImageUrl,
        nome: category.nome,
        ordem: category.ordem,
      }),
      method: "POST",
    }))
  },

  async updateCategory(id: number, category: MenuCategoryDraft) {
    return mapCategory(await adminRequest<BackendCategory>(`/admin/categorias/${id}`, {
      body: JSON.stringify({
        ativo: category.ativo,
        descricao: category.descricao,
        imagemUrl: category.imagem.trim() || defaultCategoryImageUrl,
        nome: category.nome,
        ordem: category.ordem,
      }),
      method: "PUT",
    }))
  },

  async updateCategoryStatus(id: number, ativo: boolean) {
    return mapCategory(await adminRequest<BackendCategory>(`/admin/categorias/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteCategory(id: number) {
    await adminRequest<void>(`/admin/categorias/${id}`, {
      method: "DELETE",
    })
  },

  async listProducts() {
    if (!adminApiBaseUrl) return []

    return (await listWithPublicFallback<BackendProduct>(productsAdminPath, "/produtos")).map(mapProduct)
  },

  async createProduct(product: MenuProductDraft) {
    const highlight = product.highlight.trim()

    return mapProduct(await adminRequest<BackendProduct>(productsAdminPath, {
      body: JSON.stringify({
        ativo: product.ativo,
        categoriaId: product.categoriaId,
        descricao: writeProductDescription(product.descricao, highlight),
        destaque: Boolean(highlight),
        highlight: highlight || null,
        imagemUrl: product.imagem,
        nome: product.nome,
        permiteAdicionais: product.permiteAdicionais,
        preco: product.preco,
        subtitle: highlight || null,
        subtitulo: highlight || null,
      }),
      method: "POST",
    }))
  },

  async updateProduct(id: number, product: MenuProductDraft) {
    const highlight = product.highlight.trim()

    return mapProduct(await adminRequest<BackendProduct>(`${productsAdminPath}/${id}`, {
      body: JSON.stringify({
        ativo: product.ativo,
        categoriaId: product.categoriaId,
        descricao: writeProductDescription(product.descricao, highlight),
        destaque: Boolean(highlight),
        highlight: highlight || null,
        imagemUrl: product.imagem,
        nome: product.nome,
        permiteAdicionais: product.permiteAdicionais,
        preco: product.preco,
        subtitle: highlight || null,
        subtitulo: highlight || null,
      }),
      method: "PUT",
    }))
  },

  async updateProductStatus(id: number, ativo: boolean) {
    return mapProduct(await adminRequest<BackendProduct>(`${productsAdminPath}/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteProduct(id: number) {
    await adminRequest<void>(`${productsAdminPath}/${id}`, {
      method: "DELETE",
    })
  },

  async listAdditionals() {
    if (!adminApiBaseUrl) return []

    return (await listWithPublicFallback<BackendAdditional>("/admin/adicionais", "/adicionais")).map(mapAdditional)
  },

  async createAdditional(additional: MenuAdditionalDraft) {
    return mapAdditional(await adminRequest<BackendAdditional>("/admin/adicionais", {
      body: JSON.stringify({
        ativo: additional.ativo,
        nomeAdicional: additional.nome,
        preco: additional.preco,
      }),
      method: "POST",
    }))
  },

  async updateAdditional(id: number, additional: MenuAdditionalDraft) {
    return mapAdditional(await adminRequest<BackendAdditional>(`/admin/adicionais/${id}`, {
      body: JSON.stringify({
        ativo: additional.ativo,
        nomeAdicional: additional.nome,
        preco: additional.preco,
      }),
      method: "PUT",
    }))
  },

  async updateAdditionalStatus(id: number, ativo: boolean) {
    return mapAdditional(await adminRequest<BackendAdditional>(`/admin/adicionais/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteAdditional(id: number) {
    await adminRequest<void>(`/admin/adicionais/${id}`, {
      method: "DELETE",
    })
  }
}
