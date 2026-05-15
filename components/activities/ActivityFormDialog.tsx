/**
 * Activity Form Dialog Component
 * Modal form for creating/editing plot activities with image upload
 * Supports up to 3 image attachments with counter
 */

"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import type { Station, PlotActivity } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getActivityTypes } from "@/services/activityService"
import { ImagePlus, X } from "lucide-react"

interface ActivityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ActivityFormData) => Promise<void>
  stations: Station[]
  editActivity?: PlotActivity | null
  defaultDate?: Date
}

export interface ActivityFormData {
  stationId: string
  date: string // ISO date string
  activityType: string
  description: string
  images: string[] // Up to 3 image URLs
}

const MAX_IMAGES = 3

export function ActivityFormDialog({ open, onOpenChange, onSubmit, stations, editActivity, defaultDate }: ActivityFormDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activityTypes = useMemo(() => getActivityTypes(), [])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [stationId, setStationId] = useState("")
  const [date, setDate] = useState("")
  const [activityType, setActivityType] = useState("")
  const [description, setDescription] = useState("")
  const [images, setImages] = useState<string[]>([])

  // Initialize form when editing
  useEffect(() => {
    // Local-timezone YYYY-MM-DD (toISOString shifts to UTC and corrupts the date)
    const localKey = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${day}`
    }
    if (editActivity) {
      setStationId(editActivity.stationId)
      setDate(localKey(new Date(editActivity.date)))
      setActivityType(editActivity.activityType)
      setDescription(editActivity.description)
      setImages(editActivity.images)
    } else {
      // Reset form for new activity
      setStationId(stations[0]?.id || "")
      setDate(localKey(defaultDate ?? new Date()))
      setActivityType(activityTypes[0])
      setDescription("")
      setImages([])
    }
  }, [editActivity, stations, activityTypes, open, defaultDate])

  const [fileError, setFileError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)

  // Convert HEIC/HEIF → JPEG blob (dynamic import — heic2any is browser-only)
  const convertHeic = async (file: File): Promise<File> => {
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif"
    if (!isHeic) return file
    const heic2any = (await import("heic2any")).default
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }) as Blob
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" })
  }

  // Handle real image file upload → (HEIC auto-convert) → base64
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const files = Array.from(e.target.files ?? [])
    const slots = MAX_IMAGES - images.length
    const toProcess = files.slice(0, slots)
    if (toProcess.length === 0) return
    setConverting(true)
    try {
      const converted = await Promise.all(toProcess.map(async f => {
        try { return await convertHeic(f) }
        catch (e) { console.error("HEIC convert failed:", e); return null }
      }))
      const valid = converted.filter((f): f is File => f !== null)
      if (valid.length < toProcess.length) {
        setFileError("บางไฟล์แปลงไม่สำเร็จ — ลองอีกครั้งหรือใช้ JPG/PNG")
      }
      const dataUrls = await Promise.all(valid.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })))
      setImages([...images, ...dataUrls])
    } finally {
      setConverting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleAddImage = () => {
    fileInputRef.current?.click()
  }

  // Handle image removal
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSubmit({
        stationId,
        date,
        activityType,
        description,
        images,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to submit activity", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editActivity ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"}</DialogTitle>
          <DialogDescription>บันทึกกิจกรรมในแปลงเพาะปลูก (สามารถแนบรูปภาพได้สูงสุด 3 รูป)</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Station selector */}
          <div className="space-y-2">
            <Label htmlFor="station">สถานี/แปลง</Label>
            <Select value={stationId} onValueChange={setStationId} required>
              <SelectTrigger id="station">
                <SelectValue placeholder="เลือกสถานี" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">วันที่ทำกิจกรรม</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          {/* Activity type */}
          <div className="space-y-2">
            <Label htmlFor="type">ประเภทกิจกรรม</Label>
            <Select value={activityType} onValueChange={setActivityType} required>
              <SelectTrigger id="type">
                <SelectValue placeholder="เลือกประเภท" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">รายละเอียด</Label>
            <Textarea
              id="description"
              placeholder="อธิบายกิจกรรมที่ทำ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
            />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                รูปภาพ ({images.length}/{MAX_IMAGES})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddImage}
                disabled={images.length >= MAX_IMAGES || converting}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {converting ? "กำลังแปลง..." : "เลือกรูป"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {fileError && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                ⚠️ {fileError}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">รองรับ JPG/PNG/WebP/GIF + **HEIC** (จาก iPhone — แปลงอัตโนมัติ)</p>

            {images.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {images.map((imageUrl, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-lg border">
                    <img
                      src={imageUrl || "/placeholder.svg"}
                      alt={`รูป ${idx + 1}`}
                      className="h-32 w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {images.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                ยังไม่มีรูปภาพ (สามารถเพิ่มได้สูงสุด 3 รูป)
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "กำลังบันทึก..." : editActivity ? "บันทึกการแก้ไข" : "เพิ่มกิจกรรม"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
