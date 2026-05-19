"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function VpdInfoButton({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 hover:bg-emerald-200 cursor-help shrink-0 ${className || ""}`}
          onClick={(e) => e.preventDefault()}
        >
          <Info className="h-2.5 w-2.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
        ค่าความต่างของแรงดันไอน้ำในอากาศกับภายในใบพืช
      </TooltipContent>
    </Tooltip>
  )
}
