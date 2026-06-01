"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { SimPayment, SimPaymentStatus, Station } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { th } from "date-fns/locale"

interface PaymentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stations: Station[]
  payment?: SimPayment
  onSubmit: (data: Partial<SimPayment>) => void
}

export function PaymentFormDialog({ open, onOpenChange, stations, payment, onSubmit }: PaymentFormDialogProps) {
  const [stationId, setStationId] = useState(payment?.stationId || "")
  const [simNumber, setSimNumber] = useState(payment?.simNumber || "")
  const [provider, setProvider] = useState(payment?.provider || "AIS")
  const [dueDate, setDueDate] = useState<Date | undefined>(payment?.dueDate ? new Date(payment.dueDate) : undefined)
  const [status, setStatus] = useState<SimPaymentStatus>(payment?.status || "pending")
  const [paidDate, setPaidDate] = useState<Date | undefined>(payment?.paidDate ? new Date(payment.paidDate) : undefined)
  const [notes, setNotes] = useState(payment?.notes || "")

  // Reset form when payment prop changes
  useEffect(() => {
    setStationId(payment?.stationId || "")
    setSimNumber(payment?.simNumber || "")
    setProvider(payment?.provider || "AIS")
    setDueDate(payment?.dueDate ? new Date(payment.dueDate) : undefined)
    setStatus(payment?.status || "pending")
    setPaidDate(payment?.paidDate ? new Date(payment.paidDate) : undefined)
    setNotes(payment?.notes || "")
  }, [payment, open])

  // Only main stations (wimarc1-30, no "c" suffix)
  const mainStations = stations.filter(s => !s.id.endsWith("c"))
    .sort((a, b) => {
      const na = parseInt(a.id.replace(/^wimarc/, ""), 10) || 0
      const nb = parseInt(b.id.replace(/^wimarc/, ""), 10) || 0
      return na - nb
    })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stationId || !simNumber || !provider || !dueDate) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน")
      return
    }
    onSubmit({
      stationId,
      simNumber,
      provider,
      amount: 0,
      dueDate,
      status,
      paidDate: status === "paid" ? paidDate : undefined,
      notes,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? "แก้ไขรายการซิม" : "เพิ่มรายการซิมใหม่"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Station */}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">สถานี *</Label>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="เลือกสถานี wimarc 1-30" />
                </SelectTrigger>
                <SelectContent>
                  {mainStations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id} — {s.name.split("—")[1]?.trim() || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SIM number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">หมายเลขซิม *</Label>
              <Input value={simNumber} onChange={e => setSimNumber(e.target.value)} placeholder="08X-XXX-XXXX" className="h-9 font-mono" />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">ผู้ให้บริการ *</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AIS">AIS</SelectItem>
                  <SelectItem value="DTAC">DTAC</SelectItem>
                  <SelectItem value="TRUE">TRUE</SelectItem>
                  <SelectItem value="NT">NT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">วันครบกำหนด *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd MMM yyyy", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">สถานะ</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as SimPaymentStatus)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอชำระ</SelectItem>
                  <SelectItem value="paid">ชำระแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Paid date (conditional) */}
            {status === "paid" && (
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">วันที่ชำระเงิน</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paidDate ? format(paidDate, "dd MMM yyyy", { locale: th }) : "เลือกวันที่"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={paidDate} onSelect={setPaidDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-muted-foreground">หมายเหตุ</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="เพิ่มหมายเหตุ..." rows={2} className="text-sm" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">{payment ? "บันทึก" : "เพิ่ม"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
