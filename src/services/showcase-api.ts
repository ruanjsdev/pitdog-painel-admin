const officialShowcaseApiUrl = "https://pitsdog-cardapio-oficial.onrender.com/api"
const configuredShowcaseApiUrl =
  import.meta.env.VITE_SHOWCASE_API_URL ??
  import.meta.env.VITE_CARDAPIO_API_URL ??
  officialShowcaseApiUrl
const showcaseApiUrl = configuredShowcaseApiUrl.replace(/\/$/, "")

type ShowcaseResponse = {
  productIds?: Array<number | string>
}

function normalizeProductIds(productIds: Array<number | string> = []) {
  const uniqueIds: string[] = []

  productIds.forEach((productId) => {
    const normalizedId = String(productId).trim()

    if (normalizedId && !uniqueIds.includes(normalizedId)) {
      uniqueIds.push(normalizedId)
    }
  })

  return uniqueIds.slice(0, 3)
}

async function requestShowcase(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers)

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${showcaseApiUrl}${path}`, {
    ...options,
    cache: "no-store",
    headers,
  })
  const payload = await response.json().catch(() => null) as ShowcaseResponse | { message?: string } | null

  if (!response.ok) {
    throw new Error(payload && "message" in payload && payload.message ? payload.message : "Nao foi possivel salvar a vitrine do site.")
  }

  return payload as ShowcaseResponse
}

export async function loadProductShowcase() {
  const payload = await requestShowcase("/showcase")

  return normalizeProductIds(payload.productIds)
}

export async function saveProductShowcase(productIds: string[]) {
  const payload = await requestShowcase("/showcase", {
    body: JSON.stringify({ productIds: normalizeProductIds(productIds) }),
    method: "PUT",
  })

  return normalizeProductIds(payload.productIds)
}
