/**
 * Activity Detail Modal Component
 * Displays full activity details including images in a modal dialog
 */

"use client"

import type { PlotActivity } from "@/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatThaiDate, formatThaiDateTime } from "@/utils/dateUtils"
import { Calendar, User, ImageIcon, Download } from "lucide-react"

interface ActivityModalProps {
  activity: PlotActivity | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canDownload?: boolean
}

function extFromDataUrl(url: string): string {
  const m = url.match(/^data:image\/(\w+);/)
  return m ? m[1].toLowerCase() : "jpg"
}

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function ActivityModal({ activity, open, onOpenChange, canDownload = true }: ActivityModalProps) {
  if (!activity) return null

  const handleDownloadOne = (url: string, idx: number) => {
    const ext = extFromDataUrl(url)
    const datePart = new Date(activity.date).toISOString().slice(0, 10)
    downloadDataUrl(url, `${activity.stationId}_${datePart}_${idx + 1}.${ext}`)
  }

  const handleDownloadAll = () => {
    activity.images.forEach((url, i) => {
      // stagger downloads slightly so browser doesn't drop multiples
      setTimeout(() => handleDownloadOne(url, i), i * 150)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">รายละเอียดกิจกรรม</DialogTitle>
          <DialogDescription>ข้อมูลกิจกรรมในแปลงเพาะปลูก</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activity type badge */}
          <div>
            <Badge className="text-base">{activity.activityType}</Badge>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">วันที่ทำกิจกรรม:</span>
            <span>{formatThaiDate(activity.date)}</span>
          </div>

          {/* Created by */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">บันทึกโดย:</span>
            <span>{activity.createdByName}</span>
          </div>

          {/* Created at */}
          <div className="text-sm text-muted-foreground">บันทึกเมื่อ: {formatThaiDateTime(activity.createdAt)}</div>

          {/* Description */}
          <div>
            <h4 className="mb-2 font-medium">รายละเอียด:</h4>
            <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{activity.description}</p>
          </div>

          {/* Images */}
          {activity.images.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <h4 className="font-medium">รูปภาพ ({activity.images.length}/3)</h4>
                </div>
                {canDownload && activity.images.length > 1 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleDownloadAll}>
                    <Download className="h-3 w-3" /> ดาวน์โหลดทั้งหมด
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {activity.images.map((imageUrl, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-lg border group">
                    <img
                      src={imageUrl || "/placeholder.svg"}
                      alt={`รูปกิจกรรม ${idx + 1}`}
                      className="h-48 w-full object-cover"
                    />
                    {canDownload && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-7 w-7 bg-black/60 hover:bg-black/80 text-white opacity-80 group-hover:opacity-100"
                        onClick={() => handleDownloadOne(imageUrl, idx)}
                        title="ดาวน์โหลดรูป"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
