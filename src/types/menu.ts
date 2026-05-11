export type MenuCategory = {
  id: number
  nome: string
  descricao: string
  imagem: string | null
  ordem: number
  ativo: boolean
}

export type MenuCategoryDraft = Omit<MenuCategory, "id" | "imagem"> & {
  imagem: string
}
