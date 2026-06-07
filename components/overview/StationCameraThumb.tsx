// components/overview/StationCameraThumb.tsx
"use client"

import { ImageIcon, WifiOff } from "lucide-react"
import type { OverviewStation } from "./overviewTypes"

/**
 * Renders the live camera image for a station unit. When no imageUrl is
 * available it falls back to a neutral placeholder (matching the dashboard's
 * camera card placeholder). `variant` only changes the corner label.
 */
export function StationCameraThumb({
  station,
  variant = "main",
  aspect = "aspect-[16/10]",
  rounded = "rounded-none",
  showBadge = true,
}: {
  station: OverviewStation
  variant?: "main" | "client"
  aspect?: string
  rounded?: string
  showBadge?: boolean
}) {
  const unit = variant === "client" ? station.client : station.main
  const offline = station.status === "offline"
  const src = unit.imageUrl
    ? `${unit.imageUrl}?t=${unit.imageTime?.getTime() ?? 0}`
    : null

  return (
    <div className={`relative w-full ${aspect} ${rounded} overflow-hidden bg-muted`}>
      {src && !offline ? (
        <img
          src={src}
          alt={`${variant === "client" ? "ภาพดิน" : "ภาพสถานี"} ${station.name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
          {offline ? <WifiOff className="h-7 w-7" /> : <ImageIcon className="h-8 w-8" />}
        </div>
      )}

      <span className="absolute left-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[0.45rem] font-semibold uppercase text-white">
        {variant === "client" ? "Client" : "Main"}
      </span>

      {showBadge && (
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[0.475rem] text-white">
          <ImageIcon className="h-3 w-3" />
          {offline ? "ไม่มีสัญญาณ" : "LIVE"}
        </span>
      )}
    </div>
  )
}
