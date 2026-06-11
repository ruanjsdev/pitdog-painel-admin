const productionApiBaseUrl = "https://pitsdog-api-production.up.railway.app"

const adminTokenKey = "pitsdog:admin:token:v1"
const testAdminEmail = "admin-teste@pitsdog.local"
const testAdminPassword = "pitsdog123"
export const adminSessionExpiredEvent = "pitsdog:admin:session-expired"

function resolveApiBaseUrl(value?: string) {
  const configuredUrl = value?.replace(/\/$/, "")

  if (!configuredUrl) {
    return import.meta.env.DEV ? "/api-backend" : ""
  }

  if (import.meta.env.DEV && configuredUrl === productionApiBaseUrl) {
    return "/api-backend"
  }

  if (import.meta.env.PROD && configuredUrl.startsWith("/")) {
    return productionApiBaseUrl
  }

  return configuredUrl
}

export const adminApiBaseUrl = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_MENU_API_BASE_URL
)

type LoginResponse = {
  accessToken?: string
  expiraEm?: number
  expirEm?: number
  jwt?: string
  tipo?: string
  token?: string
}

function hasTestAdminLogin(email: string, senha: string) {
  return (
    !adminApiBaseUrl &&
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_TEST_ADMIN_LOGIN === "true" &&
    email === testAdminEmail &&
    senha === testAdminPassword
  )
}

export class AdminApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
  }
}

export function getAdminToken() {
  try {
    return window.sessionStorage.getItem(adminTokenKey)
  } catch {
    return null
  }
}

export function hasAdminSession() {
  return Boolean(getAdminToken())
}

export function clearAdminSession({ notify = false } = {}) {
  try {
    window.sessionStorage.removeItem(adminTokenKey)
  } catch {
    // Session storage may be unavailable in restricted browser modes.
  }

  if (notify) {
    window.dispatchEvent(new Event(adminSessionExpiredEvent))
  }
}

function saveAdminSession(token: string) {
  window.sessionStorage.setItem(adminTokenKey, token)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new AdminApiError(response.status, "A API respondeu em formato invalido.")
  }

  if (!response.ok) {
    const fallbackMessages: Record<number, string> = {
      401: "Sessão expirada ou acesso não autorizado. Faça login novamente.",
      403: "Você não tem permissão para realizar esta ação.",
      404: "Recurso não encontrado.",
      409: "Não foi possível concluir porque existem dados relacionados.",
      429: "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.",
      500: "Erro interno no servidor. Tente novamente ou contate o suporte.",
    }

    if (response.status >= 500) {
      console.error(`[API Admin] Erro 500 em ${response.url}:`, payload)
    }

    const message =
      payload?.message ??
      payload?.error ??
      fallbackMessages[response.status] ??
      `Requisição falhou: ${response.status}`

    throw new AdminApiError(response.status, message)
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data as T
  }

  return payload as T
}

export async function adminRequest<T>(
  path: string,
  options?: RequestInit,
  settings: { auth?: boolean } = {}
): Promise<T> {
  if (!adminApiBaseUrl) {
    throw new Error("Backend URL is not configured.")
  }

  const headers = new Headers(options?.headers)

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  if (settings.auth !== false) {
    const token = getAdminToken()

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${adminApiBaseUrl}${path}`, {
    ...options,
    headers,
  })

  if ((response.status === 401 || response.status === 403) && settings.auth !== false) {
    clearAdminSession({ notify: true })
  }

  if (response.status === 204) return undefined as T

  return parseResponse<T>(response)
}

export async function loginAdmin(email: string, senha: string) {
  if (hasTestAdminLogin(email, senha)) {
    const session = {
      expiraEm: Date.now() + 8 * 60 * 60 * 1000,
      tipo: "ADMIN_TESTE_LOCAL",
      token: `test-admin-${Date.now()}`,
    }

    saveAdminSession(session.token)

    return session
  }

  try {
    const session = await adminRequest<LoginResponse>("/auth/login", {
      body: JSON.stringify({ email, senha }),
      method: "POST",
    }, { auth: false })

    const token = session?.token ?? session?.accessToken ?? session?.jwt

    if (!token) {
      throw new Error("A API não retornou o token do admin.")
    }

    saveAdminSession(token)

    return { ...session, token }
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      throw new Error("E-mail ou senha inválidos.")
    }

    throw error
  }
}
