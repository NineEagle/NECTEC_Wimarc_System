/**
 * User management service
 * Handles CRUD operations for users (Admin only)
 */

import type { User } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { mapUser } from "@/services/apiMappers"

/**
 * Get all users (Admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  const users = await apiRequest<any[]>("/users")
  return users.map(mapUser)
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await apiRequest<any>(`/users/${userId}`)
    return mapUser(user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create new user
 */
export async function createUser(userData: Omit<User, "id" | "createdAt">): Promise<User> {
  const payload = {
    username: userData.username,
    password: userData.password,
    role: userData.role,
    full_name: userData.fullName,
    email: userData.email,
    is_enabled: userData.isEnabled,
    permitted_station_ids: userData.permittedStationIds,
    phone: userData.phone ?? null,
  }

  const user = await apiRequest<any>("/users", {
    method: "POST",
    body: payload,
  })

  return mapUser(user)
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  updates: Partial<Omit<User, "id" | "createdAt">>,
): Promise<User | null> {
  const payload: Record<string, unknown> = {}

  if (updates.username !== undefined) payload.username = updates.username
  if (updates.password !== undefined) payload.password = updates.password
  if (updates.role !== undefined) payload.role = updates.role
  if (updates.fullName !== undefined) payload.full_name = updates.fullName
  if (updates.email !== undefined) payload.email = updates.email
  if (updates.isEnabled !== undefined) payload.is_enabled = updates.isEnabled
  if (updates.permittedStationIds !== undefined) payload.permitted_station_ids = updates.permittedStationIds
  if (updates.phone !== undefined) payload.phone = updates.phone ?? null

  try {
    const user = await apiRequest<any>(`/users/${userId}`, {
      method: "PUT",
      body: payload,
    })
    return mapUser(user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/users/${userId}`, {
      method: "DELETE",
    })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return false
    }
    throw error
  }
}

/**
 * Toggle user enabled status
 */
export async function toggleUserStatus(userId: string): Promise<boolean> {
  const user = await getUserById(userId)
  if (!user) return false
  const updated = await updateUser(userId, { isEnabled: !user.isEnabled })
  return !!updated
}
