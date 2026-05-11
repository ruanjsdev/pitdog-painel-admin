import { useEffect, useState } from "react"

import { hasMenuBackend, menuApi } from "../services/menu-api"
import type { MenuCategory, MenuCategoryDraft } from "../types/menu"

type MenuConnectionStatus = "not-configured" | "online" | "offline"

function sortCategories(categories: MenuCategory[]) {
  return [...categories].sort((first, second) => first.ordem - second.ordem)
}

export function useMenuAdmin() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [status, setStatus] = useState<MenuConnectionStatus>(
    hasMenuBackend ? "offline" : "not-configured"
  )

  useEffect(() => {
    let isMounted = true

    async function loadCategories() {
      try {
        const menuCategories = await menuApi.listCategories()

        if (!isMounted) return

        setCategories(sortCategories(menuCategories))
        setStatus(hasMenuBackend ? "online" : "not-configured")
      } catch {
        if (isMounted) setStatus("offline")
      }
    }

    void loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

  async function createCategory(category: MenuCategoryDraft) {
    const createdCategory = await menuApi.createCategory(category)

    setCategories((currentCategories) => sortCategories([...currentCategories, createdCategory]))
  }

  async function updateCategory(id: number, category: MenuCategoryDraft) {
    const updatedCategory = await menuApi.updateCategory(id, category)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
  }

  async function updateCategoryStatus(id: number, ativo: boolean) {
    const updatedCategory = await menuApi.updateCategoryStatus(id, ativo)

    setCategories((currentCategories) =>
      sortCategories(currentCategories.map((currentCategory) => (
        currentCategory.id === id ? updatedCategory : currentCategory
      )))
    )
  }

  async function deleteCategory(id: number) {
    await menuApi.deleteCategory(id)

    setCategories((currentCategories) =>
      currentCategories.filter((currentCategory) => currentCategory.id !== id)
    )
  }

  return {
    categories,
    createCategory,
    deleteCategory,
    isConnected: status === "online",
    status,
    updateCategory,
    updateCategoryStatus,
  }
}
