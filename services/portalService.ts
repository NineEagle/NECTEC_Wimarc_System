const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/backend") + "/portal"

async function portalRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("portal_token") : null
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

export interface PortalUser {
  id: string
  email: string
  name: string
  organization?: string | null
}

export type DataScope = "sensor" | "forecast"

export interface PortalApiKey {
  id: string
  name: string
  description?: string | null
  externalUserId: string
  isActive: boolean
  allowedStations: string[] | null
  dataScope: DataScope[]
  createdAt: string
  expiresAt?: string | null
  lastUsedAt?: string | null
}

export interface PortalApiKeyCreateResponse extends PortalApiKey {
  key: string
}

export interface UsageLog {
  id: number
  apiKeyId: string
  path: string
  method: string
  ipAddress?: string | null
  timestamp: string
}

function mapKey(d: any): PortalApiKey {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    externalUserId: d.external_user_id,
    isActive: d.is_active,
    allowedStations: d.allowed_stations ?? null,
    dataScope: d.data_scope ?? ["sensor", "forecast"],
    createdAt: d.created_at,
    expiresAt: d.expires_at ?? null,
    lastUsedAt: d.last_used_at ?? null,
  }
}

export async function sendOtp(email: string, name: string, organization?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, organization }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Failed to send OTP")
  }
}

export async function verifyOtp(email: string, otp: string, name: string, organization?: string): Promise<{ token: string; user: PortalUser }> {
  const res = await fetch(`${API_BASE}/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-portal-name": name,
      ...(organization ? { "x-portal-org": organization } : {}),
    },
    body: JSON.stringify({ email, otp }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Invalid OTP")
  }
  return res.json()
}

export async function getPortalMe(): Promise<PortalUser> {
  return portalRequest<any>("/me")
}

export async function listPortalApiKeys(): Promise<PortalApiKey[]> {
  const data = await portalRequest<any[]>("/api-keys")
  return data.map(mapKey)
}

export async function createPortalApiKey(name: string, description?: string, expiresAt?: string | null, dataScope?: DataScope[]): Promise<PortalApiKeyCreateResponse> {
  const data = await portalRequest<any>("/api-keys", {
    method: "POST",
    body: { name, description, expires_at: expiresAt ?? null, data_scope: dataScope ?? ["sensor", "forecast"] },
  })
  return { ...mapKey(data), key: data.key }
}

export async function revokePortalApiKey(id: string): Promise<void> {
  await portalRequest(`/api-keys/${id}`, { method: "DELETE" })
}

export async function getPortalKeyUsage(keyId: string, limit = 100): Promise<UsageLog[]> {
  const data = await portalRequest<any[]>(`/api-keys/${keyId}/usage?limit=${limit}`)
  return data.map(d => ({
    id: d.id,
    apiKeyId: d.api_key_id,
    path: d.path,
    method: d.method,
    ipAddress: d.ip_address ?? null,
    timestamp: d.timestamp,
  }))
}
