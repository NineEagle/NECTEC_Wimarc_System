/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 * Manages user login, logout, and session persistence
 */

"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User, AuthContextType } from "@/types"
import { authenticateUser } from "@/services/authService"

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider component
 * Wraps the application to provide authentication state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("wimarc_user")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        if (parsedUser?.createdAt) {
          parsedUser.createdAt = new Date(parsedUser.createdAt)
        }
        setUser(parsedUser)
      } catch (error) {
        console.error("Failed to parse stored user", error)
        localStorage.removeItem("wimarc_user")
      }
    }
    setIsLoading(false)
  }, [])

  /**
   * Login function
   * Authenticates user and stores session
   */
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const authenticatedUser = await authenticateUser(username, password)

      if (authenticatedUser) {
        setUser(authenticatedUser)
        localStorage.setItem("wimarc_user", JSON.stringify(authenticatedUser))
        return true
      }

      return false
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  /**
   * Logout function
   * Clears user session
   */
  const logout = () => {
    setUser(null)
    localStorage.removeItem("wimarc_user")
    localStorage.removeItem("wimarc_token")
  }

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use authentication context
 * Must be used within AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
