import { useEffect, useState } from "react"

import { hasMenuBackend, menuApi } from "../services/menu-api"
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

export function useMenuAdmin() {
  const [cachedMenu] = useState(readMenuCache)
  const [categories, setCategories] = useState<MenuCategory[]>(cachedMenu.categories)
  const [products, setProducts] = useState<MenuProduct[]>(cachedMenu.products)
  const [additionals, setAdditionals] = useState<MenuAdditional[]>(cachedMenu.additionals)
  const [status, setStatus] = useState<MenuConnectionStatus>(
    hasMenuBackend ? "offline" : "not-configured"
  )

  useEffect(() => {
    let isMounted = true

    async function loadMenu() {
      if (!hasMenuBackend) {
        setStatus("not-configured")
        return
      }

      const [menuCategories, menuProducts, menuAdditionals] = await Promise.allSettled([
        menuApi.listCategories(),
        menuApi.listProducts(),
        menuApi.listAdditionals(),
      ])

      if (!isMounted) return

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
    }

    void loadMenu()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (categories.length === 0 && products.length === 0 && additionals.length === 0) return

    writeMenuCache({ additionals, categories, products })
  }, [additionals, categories, products])

  async function createCategory(category: MenuCategoryDraft) {
    const createdCategory = await menuApi.createCategory(category)

    setCategories((currentCategories) => sortCategories([...currentCategories, createdCategory]))
    setStatus("online")
  }

  async function updateCategory(id: number, category: MenuCategoryDraft) {
    const updatedCategory = await menuApi.updateCategory(id, category)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
    setStatus("online")
  }

  async function updateCategoryStatus(id: number, ativo: boolean) {
    const updatedCategory = await menuApi.updateCategoryStatus(id, ativo)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
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
    const createdProduct = await menuApi.createProduct(product)

    setProducts((currentProducts) => sortByName([...currentProducts, createdProduct]))
    setStatus("online")
  }

  async function updateProduct(id: number, product: MenuProductDraft) {
    const updatedProduct = await menuApi.updateProduct(id, product)

    setProducts((currentProducts) =>
      sortByName(currentProducts.map((currentProduct) => (
        currentProduct.id === id ? updatedProduct : currentProduct
      )))
    )
    setStatus("online")
  }

  async function updateProductStatus(product: MenuProduct) {
    const updatedProduct = await menuApi.updateProductStatus(product.id, !product.ativo)

    setProducts((currentProducts) =>
      sortByName(currentProducts.map((currentProduct) => (
        currentProduct.id === product.id ? updatedProduct : currentProduct
      )))
    )
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
    const createdAdditional = await menuApi.createAdditional(additional)

    setAdditionals((currentAdditionals) => sortByName([...currentAdditionals, createdAdditional]))
    setStatus("online")
  }

  async function updateAdditional(id: number, additional: MenuAdditionalDraft) {
    const updatedAdditional = await menuApi.updateAdditional(id, additional)

    setAdditionals((currentAdditionals) =>
      sortByName(currentAdditionals.map((currentAdditional) => (
        currentAdditional.id === id ? updatedAdditional : currentAdditional
      )))
    )
    setStatus("online")
  }

  async function updateAdditionalStatus(additional: MenuAdditional) {
    const updatedAdditional = await menuApi.updateAdditionalStatus(additional.id, !additional.ativo)

    setAdditionals((currentAdditionals) =>
      sortByName(currentAdditionals.map((currentAdditional) => (
        currentAdditional.id === additional.id ? updatedAdditional : currentAdditional
      )))
    )
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
