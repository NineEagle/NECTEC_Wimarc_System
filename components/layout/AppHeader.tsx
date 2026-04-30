"use client"

import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Waves, Menu } from "lucide-react"
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

        {/* Center: station selectors — desktop (lg+) only */}
        {!stationLoading && (
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            {clients.length > 0 && (
              <Select value={selectedClientId ?? undefined} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="เลือกไคลเอนต์" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedStationId ?? undefined} onValueChange={setSelectedStationId}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="เลือกสถานี" />
              </SelectTrigger>
              <SelectContent>
                {stationsForClient.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
