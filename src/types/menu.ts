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
  imageFile?: File | null
}

export type MenuProduct = {
  id: number
  addonIds?: string[]
  addons?: MenuAdditional[]
  nome: string
  destaque?: boolean
  highlight?: string | null
  subtitle?: string | null
  descricao: string
  preco: number
  ativo: boolean
  imagem?: string | null
  imageUrl?: string | null
  categoriaId: number
  permiteAdicionais?: boolean
  hasFlavors?: boolean
  flavorRequired?: boolean
  flavorIds?: string[]
  maxFlavors?: number
}

export type MenuProductDraft = {
  addonIds?: string[]
  nome: string
  highlight: string
  descricao: string
  preco: number
  ativo: boolean
  imagem: string
  imageFile?: File | null
  categoriaId: number
  permiteAdicionais: boolean
  hasFlavors?: boolean
  flavorRequired?: boolean
  flavorIds?: string[]
  maxFlavors?: number
}

export type MenuAdditional = {
  id: number
  nome: string
  descricao: string
  preco: number
  ativo: boolean
  imagem?: string | null
  imageUrl?: string | null
}

export type MenuAdditionalDraft = Omit<MenuAdditional, "id"> & {
  imageFile?: File | null
}

export type Addon = {
  id: string
  name: string
  description?: string
  price: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export type ProductAddonLink = {
  active?: boolean
  addonId: string
  priceOverride?: number
  productId: string
}

export type ProductFlavor = {
  id: string
  name: string
  active: boolean
  categoryId?: string
  productId?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type ProductFlavorDraft = Omit<ProductFlavor, "createdAt" | "id" | "updatedAt">
