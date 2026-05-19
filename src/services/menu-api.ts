import type {
  MenuAdditional,
  MenuAdditionalDraft,
  MenuCategory,
  MenuCategoryDraft,
  MenuProduct,
  MenuProductDraft,
} from "../types/menu"

const menuApiBaseUrl = (
  import.meta.env.VITE_MENU_API_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL
)?.replace(/\/$/, "")

export const hasMenuBackend = Boolean(menuApiBaseUrl)

const defaultCategoryImageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!menuApiBaseUrl) {
    throw new Error("Menu backend URL is not configured.")
  }

  const headers = new Headers(options?.headers)

  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${menuApiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`Menu request failed: ${response.status}`)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()

  if (!text) return undefined as T

  return JSON.parse(text) as T
}

type BackendCategory = Omit<MenuCategory, "imagem" | "imageUrl"> & {
  imagemUrl?: string | null
}

type BackendProduct = Omit<MenuProduct, "imagem" | "imageUrl"> & {
  categoriaNome?: string
  destaque?: string | null
  imagemUrl?: string | null
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

function mapCategory(category: BackendCategory): MenuCategory {
  return {
    ...category,
    imageUrl: category.imagemUrl ?? null,
    imagem: category.imagemUrl ?? null,
  }
}

function mapProduct(product: BackendProduct): MenuProduct {
  const highlight = product.highlight ?? product.subtitle ?? product.destaque ?? product.subtitulo ?? null

  return {
    ...product,
    highlight,
    subtitle: product.subtitle ?? highlight,
    imageUrl: product.imagemUrl ?? null,
    imagem: product.imagemUrl ?? null,
  }
}

function mapAdditional(additional: BackendAdditional): MenuAdditional {
  return {
    ativo: additional.ativo,
    descricao: "",
    id: additional.id,
    nome: additional.nomeAdicional ?? additional.nomedAicional ?? additional.nome ?? "Adicional",
    preco: additional.preco,
  }
}

export const menuApi = {
  async listCategories() {
    if (!menuApiBaseUrl) return []

    return (await request<BackendCategory[]>("/admin/categorias")).map(mapCategory)
  },

  async createCategory(category: MenuCategoryDraft) {
    return mapCategory(await request<BackendCategory>("/admin/categorias", {
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
    return mapCategory(await request<BackendCategory>(`/admin/categorias/${id}`, {
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
    return mapCategory(await request<BackendCategory>(`/admin/categorias/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteCategory(id: number) {
    await request<void>(`/admin/categorias/${id}`, {
      method: "DELETE",
    })
  },

  async listProducts() {
    if (!menuApiBaseUrl) return []

    return (await request<BackendProduct[]>("/produtos")).map(mapProduct)
  },

  async createProduct(product: MenuProductDraft) {
    return mapProduct(await request<BackendProduct>("/admin/produtos", {
      body: JSON.stringify({
        ativo: product.ativo,
        categoriaId: product.categoriaId,
        descricao: product.descricao,
        destaque: product.highlight.trim() || null,
        highlight: product.highlight.trim() || null,
        imagemUrl: product.imagem,
        nome: product.nome,
        preco: product.preco,
        subtitle: product.highlight.trim() || null,
        subtitulo: product.highlight.trim() || null,
      }),
      method: "POST",
    }))
  },

  async updateProduct(id: number, product: MenuProductDraft) {
    return mapProduct(await request<BackendProduct>(`/admin/produtos/${id}`, {
      body: JSON.stringify({
        ativo: product.ativo,
        categoriaId: product.categoriaId,
        descricao: product.descricao,
        destaque: product.highlight.trim() || null,
        highlight: product.highlight.trim() || null,
        imagemUrl: product.imagem,
        nome: product.nome,
        preco: product.preco,
        subtitle: product.highlight.trim() || null,
        subtitulo: product.highlight.trim() || null,
      }),
      method: "PUT",
    }))
  },

  async updateProductStatus(id: number, ativo: boolean) {
    return mapProduct(await request<BackendProduct>(`/admin/produtos/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteProduct(id: number) {
    await request<void>(`/admin/produtos/${id}`, {
      method: "DELETE",
    })
  },

  async listAdditionals() {
    if (!menuApiBaseUrl) return []

    return (await request<BackendAdditional[]>("/adicionais")).map(mapAdditional)
  },

  async createAdditional(additional: MenuAdditionalDraft) {
    return mapAdditional(await request<BackendAdditional>("/admin/adicionais", {
      body: JSON.stringify({
        ativo: additional.ativo,
        nomeAdicional: additional.nome,
        preco: additional.preco,
      }),
      method: "POST",
    }))
  },

  async updateAdditional(id: number, additional: MenuAdditionalDraft) {
    return mapAdditional(await request<BackendAdditional>(`/admin/adicionais/${id}`, {
      body: JSON.stringify({
        ativo: additional.ativo,
        nomeAdicional: additional.nome,
        preco: additional.preco,
      }),
      method: "PUT",
    }))
  },

  async updateAdditionalStatus(id: number, ativo: boolean) {
    return mapAdditional(await request<BackendAdditional>(`/admin/adicionais/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    }))
  },

  async deleteAdditional(id: number) {
    await request<void>(`/admin/adicionais/${id}`, {
      method: "DELETE",
    })
  },
}
