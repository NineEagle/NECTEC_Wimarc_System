"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { getAllStations, getNearestStation } from "@/services/stationsService"
import { getAllUsers } from "@/services/userService"
import { getPermittedStations, isAdmin } from "@/utils/permissions"
import type { Station, User } from "@/types"

type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "unsupported"

interface StationContextType {
  allStations: Station[]
  permittedStations: Station[]
  clients: User[]
  selectedClientId: string | null
  selectedStationId: string | null
  selectedStation: Station | null
  setSelectedClientId: (id: string | null) => void
  setSelectedStationId: (id: string | null) => void
  isLoading: boolean
  /** true when the station list failed to load — lets pages tell "failed" from "no data" */
  loadError: boolean
  // Guest geolocation
  isGuest: boolean
  /** Guest with no admin-assigned stations — pinned to the nearest station by geolocation */
  isGuestGeoLocked: boolean
  geoStatus: GeoStatus
  retryGeolocation: () => void
}

const StationContext = createContext<StationContextType | null>(null)

const sortStations = (stations: Station[]) =>
  [...stations].sort((a, b) => {
    const na = parseInt(a.id.replace(/\D/g, "")) || 0
    const nb = parseInt(b.id.replace(/\D/g, "")) || 0
    return na - nb
  })

export function StationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [allStations, setAllStations] = useState<Station[]>([])
  const [permittedStations, setPermittedStations] = useState<Station[]>([])
  const [clients, setClients] = useState<User[]>([])
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle")

  const isGuest = user?.role === "Guest"
  // A Guest the admin gave explicit stations to behaves like a read-only User locked to
  // those stations (weather + soil, switchable in the header). Only a Guest with nothing
  // assigned falls back to geolocation → nearest station.
  const isGuestGeoLocked = isGuest && (user?.permittedStationIds?.length ?? 0) === 0

  const selectedStation = allStations.find((s) => s.id === selectedStationId) ?? null

  // ── Guest: locate user → pick nearest station, lock to it ────────────────
  const locateGuest = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported")
      setIsLoading(false)
      return
    }
    setGeoStatus("prompting")
    setIsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const nearest = await getNearestStation(pos.coords.latitude, pos.coords.longitude)
          if (nearest) {
            setAllStations([nearest])
            setPermittedStations([nearest])
            setSelectedStationIdState(nearest.id)
          }
          setGeoStatus("granted")
        } catch {
          setGeoStatus("granted")
        } finally {
          setIsLoading(false)
        }
      },
      () => {
        // denied or unavailable — Guest cannot proceed until granted
        setGeoStatus("denied")
        setIsLoading(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }, [])

  const retryGeolocation = useCallback(() => {
    locateGuest()
  }, [locateGuest])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    // Unassigned Guest: skip normal station/user loading; use geolocation → nearest only.
    // An assigned Guest falls through to the regular load — getPermittedStations() already
    // filters by permittedStationIds, and GET /stations does the same server-side.
    if (isGuestGeoLocked) {
      locateGuest()
      return
    }

    const load = async () => {
      setIsLoading(true)
      try {
        const [stations, users] = await Promise.all([
          getAllStations(),
          // /users is admin-only — asking as User/Guest only produces a 403.
          isAdmin(user) ? getAllUsers().catch(() => [] as User[]) : Promise.resolve([] as User[]),
        ])
        const sorted = sortStations(stations)
        setAllStations(sorted)

        const permitted = sortStations(getPermittedStations(user, sorted))
        setPermittedStations(permitted)

        const ownerIds = [...new Set(permitted.map((s) => s.ownerId).filter(Boolean))]
        const clientList = users.filter((u) => ownerIds.includes(u.id))
        setClients(clientList)

        // Restore from localStorage or auto-select
        const savedStationId = typeof window !== "undefined" ? localStorage.getItem("wimarc:stationId") : null
        const savedClientId = typeof window !== "undefined" ? localStorage.getItem("wimarc:clientId") : null

        const validStation = permitted.find((s) => s.id === savedStationId)
        if (validStation) {
          setSelectedStationIdState(savedStationId)
          const client = clientList.find((c) => c.id === savedClientId)
          setSelectedClientIdState(client?.id ?? clientList[0]?.id ?? null)
        } else if (clientList.length > 0) {
          const firstClientId = clientList[0].id
          setSelectedClientIdState(firstClientId)
          localStorage.setItem("wimarc:clientId", firstClientId)
          const first = permitted.find((s) => s.ownerId === firstClientId)
          if (first) {
            setSelectedStationIdState(first.id)
            localStorage.setItem("wimarc:stationId", first.id)
          }
        } else if (permitted.length > 0) {
          setSelectedStationIdState(permitted[0].id)
          localStorage.setItem("wimarc:stationId", permitted[0].id)
        }

        setLoadError(false)
      } catch {
        // A rejected getAllStations() used to escape here and leave every page
        // stuck on its skeleton forever (same class as BUGS #25).
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [user, isAuthenticated, isGuestGeoLocked, locateGuest])

  const setSelectedClientId = (id: string | null) => {
    if (isGuestGeoLocked) return // pinned to the nearest station
    setSelectedClientIdState(id)
    if (id) localStorage.setItem("wimarc:clientId", id)
    // Auto-select first station of this client
    const first = permittedStations.find((s) => s.ownerId === id)
    if (first) {
      setSelectedStationIdState(first.id)
      localStorage.setItem("wimarc:stationId", first.id)
    }
  }

  const setSelectedStationId = (id: string | null) => {
    if (isGuestGeoLocked) return // pinned to the nearest station
    setSelectedStationIdState(id)
    if (id) localStorage.setItem("wimarc:stationId", id)
  }

  return (
    <StationContext.Provider
      value={{
        allStations,
        permittedStations,
        clients,
        selectedClientId,
        selectedStationId,
        selectedStation,
        setSelectedClientId,
        setSelectedStationId,
        isLoading,
        loadError,
        isGuest: !!isGuest,
        isGuestGeoLocked: !!isGuestGeoLocked,
        geoStatus,
        retryGeolocation,
      }}
    >
      {children}
    </StationContext.Provider>
  )
}

export function useStation() {
  const ctx = useContext(StationContext)
  if (!ctx) throw new Error("useStation must be used within StationProvider")
  return ctx
}
