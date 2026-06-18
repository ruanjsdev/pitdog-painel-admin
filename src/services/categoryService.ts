import { adminRequest } from "./admin-api"

export type AdminCategory = {
  id: number
  nome: string
  descricao?: string
  ativo?: boolean
  imagemUrl?: string
}

export type CategoryPayload = {
  nome: string
  descricao?: string
  ativo?: boolean
}

export async function listCategories() {
  return adminRequest<AdminCategory[]>("/admin/categorias")
}

export async function createCategory(payload: CategoryPayload) {
  return adminRequest<AdminCategory>("/admin/categorias", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateCategory(id: number | string, payload: CategoryPayload) {
  return adminRequest<AdminCategory>(`/admin/categorias/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function uploadCategoryImage(categoryId: number | string, file: File) {
  const formData = new FormData()
  formData.append("imagem", file)

  return adminRequest<AdminCategory>(
    `/admin/categorias/${categoryId}/imagem`,
    {
      method: "POST",
      body: formData,
    }
  )
}