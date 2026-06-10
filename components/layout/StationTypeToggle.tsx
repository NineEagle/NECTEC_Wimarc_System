"use client"

import type React from "react"

interface StationTypeToggleProps {
  value: "main" | "client" | null
  hasMain: boolean
  hasClient: boolean
  onChange: (val: "main" | "client") => void
  size?: "sm" | "md"
  fullWidth?: boolean
}

export function StationTypeToggle({ value, hasMain, hasClient, onChange, size = "md", fullWidth = false }: StationTypeToggleProps) {
  if (!hasMain && !hasClient) return null

  const btnStyle: React.CSSProperties = { padding: size === "sm" ? "5px 10px" : "7px 12px", fontSize: 12, lineHeight: 1.4 }

  if (!hasMain || !hasClient) {
    const label = hasMain ? "สถานีอากาศ" : "สถานีดิน"
    return (
      <span style={btnStyle} className={`font-medium border rounded-md flex items-center justify-center bg-background text-foreground ${fullWidth ? "w-full" : ""}`}>
        {label}
      </span>
    )
  }

  return (
    <div className={`flex bg-muted border rounded-md p-0.5 ${fullWidth ? "w-full" : "shrink-0"}`}>
      <button
        onClick={() => onChange("main")}
        style={btnStyle}
        className={`flex-1 font-bold rounded-sm transition-all whitespace-nowrap ${
          value === "main"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        สถานีอากาศ
      </button>
      <button
        onClick={() => onChange("client")}
        style={btnStyle}
        className={`flex-1 font-bold rounded-sm transition-all whitespace-nowrap ${
          value === "client"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        สถานีดิน
      </button>
    </div>
  )
}
