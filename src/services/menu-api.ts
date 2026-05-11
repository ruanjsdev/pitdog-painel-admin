import type { MenuCategory, MenuCategoryDraft } from "../types/menu"

const menuApiBaseUrl = (
  import.meta.env.VITE_MENU_API_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL
)?.replace(/\/$/, "")

export const hasMenuBackend = Boolean(menuApiBaseUrl)

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!menuApiBaseUrl) {
    throw new Error("Menu backend URL is not configured.")
  }

  const response = await fetch(`${menuApiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Menu request failed: ${response.status}`)
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

export const menuApi = {
  async listCategories() {
    if (!menuApiBaseUrl) return []

    return request<MenuCategory[]>("/admin/categorias")
  },

  async createCategory(category: MenuCategoryDraft) {
    return request<MenuCategory>("/admin/categorias", {
      body: JSON.stringify(category),
      method: "POST",
    })
  },

  async updateCategory(id: number, category: MenuCategoryDraft) {
    return request<MenuCategory>(`/admin/categorias/${id}`, {
      body: JSON.stringify(category),
      method: "PUT",
    })
  },

  async updateCategoryStatus(id: number, ativo: boolean) {
    return request<MenuCategory>(`/admin/categorias/${id}/status`, {
      body: JSON.stringify({ ativo }),
      method: "PATCH",
    })
  },

  async deleteCategory(id: number) {
    await request<void>(`/admin/categorias/${id}`, {
      method: "DELETE",
    })
  },
}
