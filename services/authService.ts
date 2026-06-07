/**
 * Authentication service
 * Handles user login and session management
 */

import type { User } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { mapUser } from "@/services/apiMappers"

/**
 * Authenticate user with username and password
 * Returns user object if credentials are valid, null otherwise
 */
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  try {
    const resp = await apiRequest<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: { username, password },
    })
    if (typeof window !== "undefined") {
      localStorage.setItem("wimarc_token", resp.token)
      localStorage.setItem("wimarc_auth_method", "password")
    }
    return mapUser(resp.user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export interface RegisterParams {
  username: string
  email: string
  password: string
  fullName: string
}

export async function registerUser(params: RegisterParams): Promise<{ pending: true }> {
  await apiRequest<{ message: string }>("/auth/register", {
    method: "POST",
    body: { username: params.username, email: params.email, password: params.password, full_name: params.fullName },
  })
  return { pending: true }
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
 * Validate session token
 * In production, this would validate a JWT or session cookie
 */
export async function validateSession(token: string): Promise<User | null> {
  void token
  return null
}
