"use client"

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

  const btnBase = size === "sm" ? "py-1.5 text-sm" : "py-2 text-sm"

  if (!hasMain || !hasClient) {
    const label = hasMain ? "สถานีอากาศ" : "สถานีดิน"
    return (
      <span className={`px-3 ${btnBase} font-medium border rounded-md flex items-center justify-center bg-background text-foreground ${fullWidth ? "w-full" : ""}`}>
        {label}
      </span>
    )
  }

  return (
    <div className={`flex bg-muted border rounded-md p-0.5 ${fullWidth ? "w-full" : "shrink-0"}`}>
      <button
        onClick={() => onChange("main")}
        className={`flex-1 px-3 ${btnBase} font-bold rounded-sm transition-all whitespace-nowrap ${
          value === "main"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        สถานีอากาศ
      </button>
      <button
        onClick={() => onChange("client")}
        className={`flex-1 px-3 ${btnBase} font-bold rounded-sm transition-all whitespace-nowrap ${
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
