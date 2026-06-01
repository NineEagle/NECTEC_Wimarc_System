"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const FONT_SIZES = [85, 92, 100, 108, 116, 125]
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
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => change(-1)}
        disabled={idx === 0}
        title="ลดขนาดตัวหนังสือ"
      >
        <span className="text-xs font-bold leading-none">A-</span>
      </Button>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => change(1)}
        disabled={idx === FONT_SIZES.length - 1}
        title="เพิ่มขนาดตัวหนังสือ"
      >
        <span className="text-sm font-bold leading-none">A+</span>
      </Button>
    </div>
  )
}

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="ml-auto flex items-center gap-1">
        <FontSizeControls />
      </div>
    </header>
  )
}
