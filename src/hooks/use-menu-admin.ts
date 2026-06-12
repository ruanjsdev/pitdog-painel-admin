import { useEffect, useState } from "react"

import { MenuImageUploadError, hasMenuBackend, menuApi } from "../services/menu-api"
import type {
  MenuAdditional,
  MenuAdditionalDraft,
  MenuCategory,
  MenuCategoryDraft,
  MenuProduct,
  MenuProductDraft,
} from "../types/menu"

type MenuConnectionStatus = "not-configured" | "online" | "offline"

const menuCacheKey = "pitsdog:admin:menu:v1"

type MenuCache = {
  additionals: MenuAdditional[]
  categories: MenuCategory[]
  products: MenuProduct[]
}

function sortCategories(categories: MenuCategory[]) {
  return [...categories].sort((first, second) => first.ordem - second.ordem)
}

function sortByName<T extends { nome: string }>(items: T[]) {
  return [...items].sort((first, second) => first.nome.localeCompare(second.nome))
}

async function uploadCategoryImage(category: MenuCategory, draft: MenuCategoryDraft) {
  if (!draft.imageFile) return category

  const imageUrl = await uploadMenuImageSafely("categoria", category.id, draft.imageFile)

  if (!imageUrl) return category

  return {
    ...category,
    imageUrl,
    imagem: imageUrl,
  }
}

async function uploadProductImage(product: MenuProduct, draft: MenuProductDraft) {
  if (!draft.imageFile) return product

  const imageUrl = await uploadMenuImageSafely("produto", product.id, draft.imageFile)

  if (!imageUrl) return product

  return {
    ...product,
    imageUrl,
    imagem: imageUrl,
  }
}

async function uploadAdditionalImage(additional: MenuAdditional, draft: MenuAdditionalDraft) {
  if (!draft.imageFile) return additional

  const imageUrl = await uploadMenuImageSafely("adicional", additional.id, draft.imageFile)

  if (!imageUrl) return additional

  return {
    ...additional,
    imageUrl,
    imagem: imageUrl,
  }
}

async function uploadMenuImageSafely(target: "adicional" | "categoria" | "produto", id: number, imageFile: File) {
  try {
    return await menuApi.uploadImage(target, id, imageFile)
  } catch (error) {
    if (error instanceof MenuImageUploadError) {
      console.warn(`[menu-api] Falha ao enviar imagem de ${target} #${id}.`, error.cause)
      throw new Error("A imagem não foi salva pela API. A confirmação só aparece quando a imagem também for salva; tente novamente.")
    }

    throw error
  }
}

function readMenuCache(): MenuCache {
  try {
    const cachedMenu = window.localStorage.getItem(menuCacheKey)

    if (!cachedMenu) return { additionals: [], categories: [], products: [] }

    const parsedMenu = JSON.parse(cachedMenu) as MenuCache

    return {
      additionals: sortByName(parsedMenu.additionals ?? []),
      categories: sortCategories(parsedMenu.categories ?? []),
      products: sortByName(parsedMenu.products ?? []),
    }
  } catch {
    return { additionals: [], categories: [], products: [] }
  }
}

function writeMenuCache(cache: MenuCache) {
  try {
    window.localStorage.setItem(menuCacheKey, JSON.stringify(cache))
  } catch {
    // Cache only keeps the admin responsive while the backend answers.
  }
}

export function useMenuAdmin(options: { autoload?: boolean } = {}) {
  const [cachedMenu] = useState(readMenuCache)
  const [categories, setCategories] = useState<MenuCategory[]>(cachedMenu.categories)
  const [products, setProducts] = useState<MenuProduct[]>(cachedMenu.products)
  const [additionals, setAdditionals] = useState<MenuAdditional[]>(cachedMenu.additionals)
  const [status, setStatus] = useState<MenuConnectionStatus>(
    hasMenuBackend ? "offline" : "not-configured"
  )

  async function loadMenu() {
    if (!hasMenuBackend) {
      setStatus("not-configured")
      return false
    }

    const [menuCategories, menuProducts, menuAdditionals] = await Promise.allSettled([
      menuApi.listCategories(),
      menuApi.listProducts(),
      menuApi.listAdditionals(),
    ])

    if (menuCategories.status === "fulfilled") {
      setCategories(sortCategories(menuCategories.value))
    }

    if (menuProducts.status === "fulfilled") {
      setProducts(sortByName(menuProducts.value))
    }

    if (menuAdditionals.status === "fulfilled") {
      setAdditionals(sortByName(menuAdditionals.value))
    }

    const hasLoadedAnyMenuData =
      menuCategories.status === "fulfilled" ||
      menuProducts.status === "fulfilled" ||
      menuAdditionals.status === "fulfilled"

    setStatus(hasLoadedAnyMenuData ? "online" : "offline")

    return hasLoadedAnyMenuData
  }

  useEffect(() => {
    if (!options.autoload) return

    void loadMenu()
  }, [options.autoload])

  useEffect(() => {
    if (categories.length === 0 && products.length === 0 && additionals.length === 0) return

    writeMenuCache({ additionals, categories, products })
  }, [additionals, categories, products])

  async function createCategory(category: MenuCategoryDraft) {
    const createdCategory = await uploadCategoryImage(await menuApi.createCategory(category), category)

    setCategories((currentCategories) => sortCategories([...currentCategories, createdCategory]))
    setStatus("online")
    return createdCategory
  }

  async function updateCategory(id: number, category: MenuCategoryDraft) {
    const updatedCategory = await uploadCategoryImage(await menuApi.updateCategory(id, category), category)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
    setStatus("online")
    return updatedCategory
  }

  async function updateCategoryStatus(id: number, ativo: boolean) {
    const updatedCategory = await menuApi.updateCategoryStatus(id, ativo)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
    return updatedCategory
  }

  function applyCategoryStatus(id: number, ativo: boolean) {
    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? { ...currentCategory, ativo } : currentCategory
      )))
    )
  }

  async function deleteCategory(id: number) {
    await menuApi.deleteCategory(id)

    setCategories((currentCategories) =>
      currentCategories.filter((currentCategory) => currentCategory.id !== id)
    )
  }

  function removeCategoryFromPanel(id: number) {
    setCategories((currentCategories) =>
      currentCategories.filter((currentCategory) => currentCategory.id !== id)
    )
  }

  function restoreCategory(category: MenuCategory) {
    setCategories((currentCategories) => sortCategories([...currentCategories, category]))
  }

  async function createProduct(product: MenuProductDraft) {
    const createdProduct = await uploadProductImage(await menuApi.createProduct(product), product)
    const productWithDraftSubtitle = {
      ...createdProduct,
      destaque: createdProduct.destaque || Boolean(product.highlight.trim()),
      highlight: createdProduct.highlight || product.highlight.trim() || null,
      subtitle: createdProduct.subtitle || product.highlight.trim() || null,
    }

    setProducts((currentProducts) => sortByName([...currentProducts, productWithDraftSubtitle]))
    setStatus("online")
    return productWithDraftSubtitle
  }

  async function updateProduct(id: number, product: MenuProductDraft) {
    const updatedProduct = await uploadProductImage(await menuApi.updateProduct(id, product), product)
    const productWithDraftSubtitle = {
      ...updatedProduct,
      destaque: updatedProduct.destaque || Boolean(product.highlight.trim()),
      highlight: updatedProduct.highlight || product.highlight.trim() || null,
      subtitle: updatedProduct.subtitle || product.highlight.trim() || null,
    }

    setProducts((currentProducts) =>
      sortByName(currentProducts.map((currentProduct) => (
        currentProduct.id === id ? productWithDraftSubtitle : currentProduct
      )))
    )
    setStatus("online")
    return productWithDraftSubtitle
  }

  async function updateProductStatus(product: MenuProduct) {
    const updatedProduct = await menuApi.updateProductStatus(product.id, !product.ativo)

    setProducts((currentProducts) =>
      sortByName(currentProducts.map((currentProduct) => (
        currentProduct.id === product.id ? updatedProduct : currentProduct
      )))
    )
    return updatedProduct
  }

  function applyProductStatus(id: number, ativo: boolean) {
    setProducts((currentProducts) =>
      sortByName(currentProducts.map((currentProduct) => (
        currentProduct.id === id ? { ...currentProduct, ativo } : currentProduct
      )))
    )
  }

  async function deleteProduct(id: number) {
    await menuApi.deleteProduct(id)

    setProducts((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== id))
  }

  function removeProductFromPanel(id: number) {
    setProducts((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== id))
  }

  function restoreProduct(product: MenuProduct) {
    setProducts((currentProducts) => sortByName([...currentProducts, product]))
  }

  async function createAdditional(additional: MenuAdditionalDraft) {
    const createdAdditional = await uploadAdditionalImage(await menuApi.createAdditional(additional), additional)

    setAdditionals((currentAdditionals) => sortByName([...currentAdditionals, createdAdditional]))
    setStatus("online")
    return createdAdditional
  }

  async function updateAdditional(id: number, additional: MenuAdditionalDraft) {
    const updatedAdditional = await uploadAdditionalImage(await menuApi.updateAdditional(id, additional), additional)

    setAdditionals((currentAdditionals) =>
      sortByName(currentAdditionals.map((currentAdditional) => (
        currentAdditional.id === id ? updatedAdditional : currentAdditional
      )))
    )
    setStatus("online")
    return updatedAdditional
  }

  async function updateAdditionalStatus(additional: MenuAdditional) {
    const updatedAdditional = await menuApi.updateAdditionalStatus(additional.id, !additional.ativo)

    setAdditionals((currentAdditionals) =>
      sortByName(currentAdditionals.map((currentAdditional) => (
        currentAdditional.id === additional.id ? updatedAdditional : currentAdditional
      )))
    )
    return updatedAdditional
  }

  function applyAdditionalStatus(id: number, ativo: boolean) {
    setAdditionals((currentAdditionals) =>
      sortByName(currentAdditionals.map((currentAdditional) => (
        currentAdditional.id === id ? { ...currentAdditional, ativo } : currentAdditional
      )))
    )
  }

  async function deleteAdditional(id: number) {
    await menuApi.deleteAdditional(id)

    setAdditionals((currentAdditionals) =>
      currentAdditionals.filter((currentAdditional) => currentAdditional.id !== id)
    )
  }

  function removeAdditionalFromPanel(id: number) {
    setAdditionals((currentAdditionals) =>
      currentAdditionals.filter((currentAdditional) => currentAdditional.id !== id)
    )
  }

  function restoreAdditional(additional: MenuAdditional) {
    setAdditionals((currentAdditionals) => sortByName([...currentAdditionals, additional]))
  }

  return {
    additionals,
    applyAdditionalStatus,
    applyCategoryStatus,
    applyProductStatus,
    categories,
    createAdditional,
    createCategory,
    createProduct,
    deleteAdditional,
    deleteCategory,
    deleteProduct,
    isConnected: status === "online",
    loadMenu,
    products,
    removeAdditionalFromPanel,
    removeCategoryFromPanel,
    removeProductFromPanel,
    restoreAdditional,
    restoreCategory,
    restoreProduct,
    status,
    updateAdditional,
    updateAdditionalStatus,
    updateCategory,
    updateCategoryStatus,
    updateProduct,
    updateProductStatus,
  }
}
