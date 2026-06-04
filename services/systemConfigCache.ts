import { getSystemConfig } from "./configService"
import type { SystemConfig } from "@/components/config/configTypes"
import { defaultSystem } from "@/components/config/configUtils"

// Module-level cache — auto-expires after 5 minutes so users on other browsers
// pick up admin config changes on their next page navigation.
const TTL_MS = 5 * 60 * 1000

let _cache: SystemConfig | null = null
let _cacheAt = 0
let _promise: Promise<SystemConfig> | null = null

export async function loadSystemConfig(): Promise<SystemConfig> {
  const now = Date.now()
  if (_cache && now - _cacheAt < TTL_MS) return _cache
  if (_promise) return _promise
  _promise = getSystemConfig()
    .then(c => { _cache = c; _cacheAt = Date.now(); return c })
    .catch(() => { _cache = defaultSystem(); _cacheAt = Date.now(); return _cache! })
    .finally(() => { _promise = null })
  return _promise
}

export function getCachedConfig(): SystemConfig {
  return _cache ?? defaultSystem()
}

export function invalidateConfigCache() {
  _cache = null
}
