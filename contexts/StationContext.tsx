"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { getAllStations } from "@/services/stationsService"
import { getAllUsers } from "@/services/userService"
import { getPermittedStations } from "@/utils/permissions"
import type { Station, User } from "@/types"

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

  const selectedStation = allStations.find((s) => s.id === selectedStationId) ?? null

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      setIsLoading(true)
      const [stations, users] = await Promise.all([
        getAllStations(),
        getAllUsers().catch(() => [] as User[]),
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

      setIsLoading(false)
    }

    load()
  }, [user, isAuthenticated])

  const setSelectedClientId = (id: string | null) => {
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
