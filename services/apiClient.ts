// In-memory GET cache (survives SPA navigation, cleared on page reload)
const _cache = new Map<string, { data: unknown; expiresAt: number }>()

function _cacheTTL(path: string): number {
  if (path.includes("/live"))     return 30_000   // 30 s — live sensor data
  if (path.includes("/forecast")) return 600_000  // 10 min
  if (path.includes("/readings") || path.includes("/daily") || path.includes("/aggregate")) return 120_000  // 2 min
  return 300_000  // 5 min — stations, users, etc.
}

export function clearApiCache(pathSubstr?: string) {
  if (!pathSubstr) { _cache.clear(); return }
  for (const k of _cache.keys()) if (k.includes(pathSubstr)) _cache.delete(k)
}

export class ApiError extends Error {
  status: number
  info?: unknown

  constructor(message: string, status: number, info?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.info = info
  }
}

type QueryValue = string | number | boolean | null | undefined
type QueryParams = Record<string, QueryValue>

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  query?: QueryParams
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/backend"

function buildUrl(path: string, query?: QueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const fullPath = API_BASE_URL + normalizedPath

  if (!query) return fullPath

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    params.set(key, String(value))
  })

  const queryStr = params.toString()
  return queryStr ? `${fullPath}?${queryStr}` : fullPath
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { query, body, headers, ...rest } = options
  const url = buildUrl(path, query)
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const requestHeaders = new Headers(headers || {})

  if (body !== undefined && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : isFormData || typeof body === "string"
          ? body
          : JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = response.statusText
    let errorInfo: unknown = null

    try {
      const data = await response.json()
      errorInfo = data
      if (typeof data?.detail === "string") {
        errorMessage = data.detail
      } else if (typeof data?.message === "string") {
        errorMessage = data.message
      }
    } catch {
      try {
        errorMessage = await response.text()
      } catch {
        errorMessage = response.statusText
      }
    }

    throw new ApiError(errorMessage || "Request failed", response.status, errorInfo)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
