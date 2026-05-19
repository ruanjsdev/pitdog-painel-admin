export type MenuCategory = {
  id: number
  nome: string
  descricao: string
  imagem: string | null
  imageUrl?: string | null
  ordem: number
  ativo: boolean
}

export type MenuCategoryDraft = Omit<MenuCategory, "id" | "imagem"> & {
  imagem: string
}

export type MenuProduct = {
  id: number
  nome: string
  highlight?: string | null
  subtitle?: string | null
  descricao: string
  preco: number
  ativo: boolean
  imagem?: string | null
  imageUrl?: string | null
  categoriaId: number
}

export type MenuProductDraft = {
  nome: string
  highlight: string
  descricao: string
  preco: number
  ativo: boolean
  imagem: string
  categoriaId: number
}

export type MenuAdditional = {
  id: number
  nome: string
  descricao: string
  preco: number
  ativo: boolean
}

export type MenuAdditionalDraft = Omit<MenuAdditional, "id">
