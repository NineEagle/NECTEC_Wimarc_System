import { apiRequest } from "@/services/apiClient"

// ── API Key Requests ──────────────────────────────────────────

export interface ApiKeyRequestItem {
  id: string
  name: string
  email: string
  organization?: string | null
  purpose: string
  status: "pending" | "approved" | "rejected"
  rejectReason?: string | null
  apiKeyId?: string | null
  createdAt: string
  reviewedAt?: string | null
}

function mapRequest(d: any): ApiKeyRequestItem {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    organization: d.organization ?? null,
    purpose: d.purpose,
    status: d.status,
    rejectReason: d.reject_reason ?? null,
    apiKeyId: d.api_key_id ?? null,
    createdAt: d.created_at,
    reviewedAt: d.reviewed_at ?? null,
  }
}

export async function listApiKeyRequests(status?: string): Promise<ApiKeyRequestItem[]> {
  const data = await apiRequest<any[]>("/admin/api-key-requests", {
    query: status ? { status } : undefined,
  })
  return data.map(mapRequest)
}

export async function approveApiKeyRequest(id: string): Promise<ApiKeyCreateResponse> {
  const data = await apiRequest<any>(`/admin/api-key-requests/${id}/approve`, { method: "POST" })
  return { ...mapApiKey(data), key: data.key }
}

export async function rejectApiKeyRequest(id: string, reason: string): Promise<ApiKeyRequestItem> {
  const data = await apiRequest<any>(`/admin/api-key-requests/${id}/reject`, {
    method: "POST",
    body: { reason },
  })
  return mapRequest(data)
}

export type DataScope = "sensor" | "forecast"

export interface ApiKey {
  id: string
  name: string
  description?: string | null
  createdBy: string
  isActive: boolean
  allowedStations: string[] | null  // null = all stations
  dataScope: DataScope[]            // which data types this key may access
  createdAt: string
  expiresAt?: string | null          // null = never expires
  lastUsedAt?: string | null
}

export interface ApiKeyCreateResponse extends ApiKey {
  key: string  // plaintext key — shown only once
}

export interface ApiKeyCreate {
  name: string
  description?: string
  allowedStations?: string[] | null  // null / undefined = all stations
  dataScope?: DataScope[]             // default: ["sensor", "forecast"]
  expiresAt?: string | null          // ISO datetime or null
}

export interface ApiKeyUpdate {
  name?: string
  description?: string | null
  isActive?: boolean
  allowedStations?: string[] | null
  dataScope?: DataScope[]
  expiresAt?: string | null
}

function mapApiKey(d: any): ApiKey {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    createdBy: d.created_by,
    isActive: d.is_active,
    allowedStations: d.allowed_stations ?? null,
    dataScope: d.data_scope ?? ["sensor", "forecast"],
    createdAt: d.created_at,
    expiresAt: d.expires_at ?? null,
    lastUsedAt: d.last_used_at ?? null,
  }
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const data = await apiRequest<any[]>("/admin/api-keys")
  return data.map(mapApiKey)
}

export async function createApiKey(payload: ApiKeyCreate): Promise<ApiKeyCreateResponse> {
  const data = await apiRequest<any>("/admin/api-keys", {
    method: "POST",
    body: {
      name: payload.name,
      description: payload.description ?? null,
      allowed_stations: payload.allowedStations ?? null,
      data_scope: payload.dataScope ?? ["sensor", "forecast"],
      expires_at: payload.expiresAt ?? null,
    },
  })
  return { ...mapApiKey(data), key: data.key }
}

export async function updateApiKey(id: string, payload: ApiKeyUpdate): Promise<ApiKey> {
  const body: Record<string, any> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.description !== undefined) body.description = payload.description
  if (payload.isActive !== undefined) body.is_active = payload.isActive
  if (payload.allowedStations !== undefined) body.allowed_stations = payload.allowedStations
  if (payload.dataScope !== undefined) body.data_scope = payload.dataScope
  if (payload.expiresAt !== undefined) body.expires_at = payload.expiresAt
  const data = await apiRequest<any>(`/admin/api-keys/${id}`, { method: "PATCH", body })
  return mapApiKey(data)
}

export async function deleteApiKey(id: string): Promise<void> {
  await apiRequest<void>(`/admin/api-keys/${id}`, { method: "DELETE" })
}

export interface UsageLog {
  id: number
  apiKeyId: string
  path: string
  method: string
  ipAddress?: string | null
  timestamp: string
}

export async function getApiKeyUsageLogs(keyId: string, limit = 200): Promise<UsageLog[]> {
  const data = await apiRequest<any[]>(`/admin/api-keys/${keyId}/usage?limit=${limit}`)
  return data.map(d => ({
    id: d.id,
    apiKeyId: d.api_key_id,
    path: d.path,
    method: d.method,
    ipAddress: d.ip_address ?? null,
    timestamp: d.timestamp,
  }))
}

export async function getPortalSettings(): Promise<{ enabled: boolean }> {
  return apiRequest<{ enabled: boolean }>("/admin/portal-settings")
}

export async function setPortalEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiRequest<{ enabled: boolean }>("/admin/portal-settings", {
    method: "PATCH",
    body: { enabled },
  })
}
