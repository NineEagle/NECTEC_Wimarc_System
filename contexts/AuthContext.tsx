/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 * Manages user login, logout, and session persistence
 */

"use client"

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { User, AuthContextType } from "@/types"
import { authenticateUser } from "@/services/authService"
import { mapUser } from "@/services/apiMappers"

const IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider component
 * Wraps the application to provide authentication state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted user from localStorage after mount (client-only)
  useEffect(() => {
    const stored = localStorage.getItem("wimarc_user")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.createdAt) parsed.createdAt = new Date(parsed.createdAt)
        setUser(parsed)
      } catch {
        localStorage.removeItem("wimarc_user")
      }
    }
  }, [])

  // Sync Google Session with local user state
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) {
      const accessToken = (session.user as any).accessToken as string | undefined
      if (!accessToken) { setIsLoading(false); return }

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/backend"
      fetch(`${apiBase}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: { token: string; user: any }) => {
          localStorage.setItem("wimarc_token", data.token)
          const mapped = mapUser(data.user)
          setUser(mapped)
          localStorage.setItem("wimarc_user", JSON.stringify(mapped))
        })
        .catch(() => {
          setUser(null)
          localStorage.removeItem("wimarc_user")
          localStorage.removeItem("wimarc_token")
        })
        .finally(() => setIsLoading(false))
    } else if (sessionStatus === "unauthenticated") {
      // If not Google authenticated, try local storage
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
      } else {
        setUser(null)
      }
      setIsLoading(false)
    } else if (sessionStatus === "loading") {
      setIsLoading(true)
    }
  }, [session, sessionStatus])

  const login = async (username: string, password: string): Promise<User | null> => {
    try {
      const authenticatedUser = await authenticateUser(username, password)

      if (authenticatedUser) {
        setUser(authenticatedUser)
        localStorage.setItem("wimarc_user", JSON.stringify(authenticatedUser))
        return authenticatedUser
      }

      return null
    } catch (error) {
      console.error("Login error:", error)
      return null
    }
  }

  const logout = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setUser(null)
    localStorage.removeItem("wimarc_user")
    localStorage.removeItem("wimarc_token")
  }, [])

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS)
  }, [logout])

  // Set up idle tracking when user is logged in
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      return
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"]
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [user, resetIdleTimer])

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAuthLoading: isLoading,
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
