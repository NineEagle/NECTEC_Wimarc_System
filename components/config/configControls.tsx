// components/config/configControls.tsx
// Small shared building blocks for the config page. The project's shadcn set
// only ships card/input/button/label/badge, so Switch / SegToggle / RangeSlider
// are implemented here with the same design tokens (no extra dependencies).
"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Info } from "lucide-react"
import { Card } from "@/components/ui/card"

// ---- section card with header (icon + title + scope pill + subtitle) + optional footer ----
export function SectionCard({
  icon: Icon, title, subtitle, scope, badge, footer, children,
}: {
  icon?: LucideIcon
  title: string
  subtitle?: string
  scope?: string
  badge?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        {Icon && (
          <span className="mt-0.5 grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-accent text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="mr-auto">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            {scope && (
              <span className="rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-bold text-primary">
                {scope}
              </span>
            )}
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div>{children}</div>
      {footer && (
        <div className="flex items-center gap-2 border-t bg-muted px-5 py-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 opacity-70" /> {footer}
        </div>
      )}
    </Card>
  )
}

// ---- toggle switch ----
export function Switch({
  checked, onChange, disabled, size = 22, label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: number
  label?: string
}) {
  const w = size * 1.8
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative shrink-0 rounded-full p-0 shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ width: w, height: size, background: checked ? "var(--color-primary)" : "var(--color-secondary)" }}
    >
      <span
        className="absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform"
        style={{ width: size - 4, height: size - 4, transform: checked ? `translateX(${w - size}px)` : "none" }}
      />
    </button>
  )
}

// ---- segmented toggle (generic small pill group) ----
export function SegToggle<T extends string | number | null>({
  value, options, onChange, size = "sm",
}: {
  value: T
  options: { value: T; label: string; danger?: boolean }[]
  onChange: (v: T) => void
  size?: "sm" | "md"
}) {
  const pad = size === "md" ? "px-[18px] py-2 text-[13px]" : "px-2.5 py-1 text-[11.5px]"
  return (
    <div className="inline-flex gap-0.5 rounded-[10px] border bg-secondary p-0.5">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg font-bold transition-colors ${pad} ${
              on
                ? `bg-background shadow-sm ${o.danger ? "text-red-600" : "text-primary"}`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---- native range slider, teal thumb (uses tokens via inline accent-color) ----
export function RangeSlider({
  value, min, max, step = 1, onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary outline-none [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
    />
  )
}

// ---- numeric input that matches the prototype's .fld-num ----
export function NumField({
  value, onChange, disabled, placeholder, className = "", width,
}: {
  value: string | number
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  width?: number
}) {
  return (
    <input
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={width ? { width } : undefined}
      className={`rounded-lg border border-input bg-background px-2.5 py-1.5 text-right font-mono text-[13px] tabular-nums text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    />
  )
}
