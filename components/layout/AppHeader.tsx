"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"
import { useStation } from "@/contexts/StationContext"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StationTypeToggle } from "@/components/layout/StationTypeToggle"
import type { Station } from "@/types"
import { ChevronDown, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"

const FONT_SIZES = [85, 92, 100, 108, 116, 125, 134, 150]
const DEFAULT_IDX = 2
const LS_KEY = "wimarc-font-size-idx"

function FontSizeControls() {
  const [idx, setIdx] = useState(DEFAULT_IDX)

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(LS_KEY) ?? "", 10)
    const i = isNaN(saved) ? DEFAULT_IDX : Math.max(0, Math.min(saved, FONT_SIZES.length - 1))
    setIdx(i)
    document.documentElement.style.fontSize = `${FONT_SIZES[i]}%`
  }, [])

  const change = useCallback((delta: number) => {
    setIdx(prev => {
      const next = Math.max(0, Math.min(prev + delta, FONT_SIZES.length - 1))
      localStorage.setItem(LS_KEY, String(next))
      document.documentElement.style.fontSize = `${FONT_SIZES[next]}%`
      return next
    })
  }, [])

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button variant="ghost" size="icon" className="h-7! w-7! text-muted-foreground hover:text-foreground"
        onClick={() => change(-1)} disabled={idx === 0} title="ลดขนาดตัวหนังสือ">
        <span className="text-[10px] font-bold leading-none">A-</span>
      </Button>
      <span className="w-[30px] text-center text-[12px] text-muted-foreground/70 select-none tabular-nums">
        {FONT_SIZES[idx]}%
      </span>
      <Button variant="ghost" size="icon" className="h-7! w-7! text-muted-foreground hover:text-foreground"
        onClick={() => change(1)} disabled={idx === FONT_SIZES.length - 1} title="เพิ่มขนาดตัวหนังสือ">
        <span className="font-bold leading-none">A+</span>
      </Button>
    </div>
  )
}

function StationPill() {
  const {
    permittedStations, clients,
    selectedStationId, setSelectedStationId,
    isLoading,
  } = useStation()

  type StationGroup = { num: number; main?: Station; client?: Station }
  const stationGroups = useMemo((): StationGroup[] => {
    const map: Record<number, StationGroup> = {}
    for (const s of permittedStations) {
      const m = s.id.match(/^wimarc(\d+)(c?)$/)
      if (!m) continue
      const n = parseInt(m[1], 10)
      if (!map[n]) map[n] = { num: n }
      if (m[2] === "c") map[n].client = s
      else map[n].main = s
    }
    return Object.values(map).sort((a, b) => a.num - b.num)
  }, [permittedStations])

  const selectedNumber = useMemo(() => {
    const m = selectedStationId?.match(/^wimarc(\d+)c?$/)
    return m ? parseInt(m[1], 10) : null
  }, [selectedStationId])

  const selectedType: "main" | "client" | null = selectedStationId
    ? selectedStationId.endsWith("c") ? "client" : "main"
    : null

  const currentGroup = stationGroups.find((g) => g.num === selectedNumber)

  const ownerName = useMemo(() => {
    const station = permittedStations.find((s) => s.id === selectedStationId)
    if (!station) return null
    const owner = clients.find((c) => c.id === station.ownerId)
    return owner?.fullName ?? null
  }, [selectedStationId, permittedStations, clients])

  const handleNumberChange = (n: number) => {
    const group = stationGroups.find((g) => g.num === n)
    if (!group) return
    const wantClient = selectedType === "client" && group.client
    const next = wantClient ? group.client! : group.main ?? group.client!
    setSelectedStationId(next.id)
  }

  const handleTypeChange = (val: string) => {
    if (!currentGroup) return
    const next = val === "client" ? currentGroup.client : currentGroup.main
    if (next) setSelectedStationId(next.id)
  }

  if (isLoading || stationGroups.length === 0) return null

  const typeLabel = selectedType === "client" ? "ดิน" : "อากาศ"
  const isSingleStation = stationGroups.length === 1
  const hasBothTypes = !!(currentGroup?.main && currentGroup?.client)

  // Single-station user: show segment button toggle
  if (isSingleStation && hasBothTypes) {
    return (
      <div className="flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-2 py-1 shadow-sm">
        <div className="hidden sm:flex items-center gap-1 pl-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">wimarc{selectedNumber}</span>
        </div>
        <div className="flex bg-muted rounded-full p-0.5">
          {(["main", "client"] as const).map((val) => (
            <button
              key={val}
              onClick={() => handleTypeChange(val)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
                selectedType === val
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {val === "main" ? "อากาศ" : "ดิน"}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted transition-colors">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-foreground">
            wimarc{selectedNumber}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{typeLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 rounded-xl shadow-lg" align="center" sideOffset={8}>
        <div className="space-y-3">
          {ownerName && (
            <p className="text-[11px] text-muted-foreground truncate">
              สวน: <span className="font-medium text-foreground">{ownerName}</span>
            </p>
          )}
          {stationGroups.length > 1 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">สถานี</p>
              <div className="flex flex-wrap gap-1.5">
                {stationGroups.map((g) => (
                  <button
                    key={g.num}
                    onClick={() => handleNumberChange(g.num)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                      g.num === selectedNumber
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    {g.num}
                  </button>
                ))}
              </div>
            </div>
          )}
          {currentGroup && (currentGroup.main || currentGroup.client) && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">ประเภท</p>
              <StationTypeToggle
                value={selectedType}
                hasMain={!!currentGroup.main}
                hasClient={!!currentGroup.client}
                onChange={handleTypeChange}
                size="sm"
                fullWidth
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AppHeader() {
  const pathname = usePathname()
  const showPill = pathname === "/dashboard"

  return (
    <div className="sticky top-0 z-40 px-3 pt-2 pb-1 pointer-events-none">
      <header className="flex h-11 shrink-0 items-center gap-2 px-3 pointer-events-auto
        rounded-2xl border border-white/60 bg-background/80 backdrop-blur-md
        shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)]">
        <SidebarTrigger className="-ml-0.5" />
        {showPill && (
          <div className="flex flex-1 items-center justify-center">
            <StationPill />
          </div>
        )}
        {!showPill && <div className="flex-1" />}
        <FontSizeControls />
      </header>
    </div>
  )
}
