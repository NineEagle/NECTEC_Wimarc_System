"use client"

import { useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Waves, Menu } from "lucide-react"
import type { Station } from "@/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getRoleDisplayName } from "@/utils/permissions"

interface AppHeaderProps {
  onMenuClick?: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const {
    clients,
    permittedStations,
    selectedClientId,
    selectedStationId,
    setSelectedClientId,
    setSelectedStationId,
    isLoading: stationLoading,
  } = useStation()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (!user) return null

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const stationsForClient = selectedClientId
    ? permittedStations.filter((s) => s.ownerId === selectedClientId)
    : permittedStations

  // Group stations by wimarc number → { N: { main?, client? } }
  const stationGroups = useMemo(() => {
    const map = new Map<number, { main?: Station; client?: Station }>()
    for (const s of permittedStations) {
      const m = s.id.match(/^wimarc(\d+)(c?)$/)
      if (!m) continue
      const n = parseInt(m[1], 10)
      const isClient = m[2] === "c"
      const entry = map.get(n) ?? {}
      if (isClient) entry.client = s
      else entry.main = s
      map.set(n, entry)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [permittedStations])

  const selectedNumber = useMemo(() => {
    const m = selectedStationId?.match(/^wimarc(\d+)c?$/)
    return m ? parseInt(m[1], 10) : null
  }, [selectedStationId])

  const selectedType: "main" | "client" | null = selectedStationId
    ? selectedStationId.endsWith("c") ? "client" : "main"
    : null

  const currentGroup = stationGroups.find(([n]) => n === selectedNumber)?.[1]

  const ownerName = useMemo(() => {
    const station = permittedStations.find((s) => s.id === selectedStationId)
    if (!station) return null
    const owner = clients.find((c) => c.id === station.ownerId)
    return owner?.fullName ?? null
  }, [selectedStationId, permittedStations, clients])

  const handleNumberChange = (val: string) => {
    const n = parseInt(val, 10)
    const entry = stationGroups.find(([num]) => num === n)?.[1]
    if (!entry) return
    const wantClient = selectedType === "client" && entry.client
    const next = wantClient ? entry.client! : entry.main ?? entry.client!
    setSelectedStationId(next.id)
  }

  const handleTypeChange = (val: string) => {
    if (!currentGroup) return
    const next = val === "client" ? currentGroup.client : currentGroup.main
    if (next) setSelectedStationId(next.id)
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-4">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Waves className="h-5 w-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold leading-none">WiMaRC</h1>
              <p className="text-xs text-muted-foreground">ระบบตรวจวัดสภาวะแวดล้อม</p>
            </div>
          </div>
        </div>

        {/* Center: wimarc number → type → owner detail (desktop lg+) */}
        {!stationLoading && stationGroups.length > 0 && (
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center min-w-0">
            <Select value={selectedNumber?.toString() ?? undefined} onValueChange={handleNumberChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="เลือกสถานี" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {stationGroups.map(([n]) => (
                  <SelectItem key={n} value={n.toString()}>
                    wimarc{n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType ?? undefined} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                {currentGroup?.main && <SelectItem value="main">อากาศ (Main)</SelectItem>}
                {currentGroup?.client && <SelectItem value="client">ดิน (Client)</SelectItem>}
              </SelectContent>
            </Select>

            {ownerName && (
              <div className="text-xs text-muted-foreground truncate max-w-[260px] px-2">
                สวน: <span className="font-medium text-foreground">{ownerName}</span>
              </div>
            )}
          </div>
        )}

        {/* Right: user menu */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-none">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{getRoleDisplayName(user.role)}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{getRoleDisplayName(user.role)}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
