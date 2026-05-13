"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { SimPaymentService } from "@/services/simPaymentService"
import type { SimPayment, Station } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PaymentFormDialog } from "@/components/payments/PaymentFormDialog"
import { Plus, Search, Download, Smartphone, Edit } from "lucide-react"
import { formatThaiDate } from "@/utils/dateUtils"
import { canEditActivities, isAdmin } from "@/utils/permissions"
import { exportToCSV } from "@/services/exportService"
import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentsPage() {
  const { user } = useAuth()
  const { permittedStations: stations, isLoading: stationsLoading } = useStation()
  const [payments, setPayments] = useState<SimPayment[]>([])
  const [selectedStation, setSelectedStation] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<SimPayment | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    const allPayments = await SimPaymentService.getPayments()
    setPayments(allPayments)
    setIsLoading(false)
  }

  useEffect(() => { if (user) loadData() }, [user])

  const handleSubmit = async (data: Partial<SimPayment>) => {
    if (editingPayment) await SimPaymentService.updatePayment(editingPayment.id, data)
    else await SimPaymentService.createPayment(data as Omit<SimPayment, "id">)
    loadData()
    setEditingPayment(undefined)
  }

  const handleMarkPaid = async (payment: SimPayment) => {
    await SimPaymentService.markAsPaid(payment.id, new Date())
    loadData()
  }

  const stationById = useMemo(() => {
    const map = new Map<string, Station>()
    for (const s of stations) map.set(s.id, s)
    return map
  }, [stations])

  // Farmer sees only own SIMs; Admin sees all
  const scopedPayments = useMemo(() => {
    if (isAdmin(user)) return payments
    const allowed = new Set(stations.map((s) => s.id))
    return payments.filter((p) => allowed.has(p.stationId))
  }, [payments, stations, user])

  const baseGroups = useMemo(() => {
    const seen = new Set<string>()
    const groups: string[] = []
    for (const s of stations) {
      const base = s.id.replace(/c$/, "")
      if (!seen.has(base)) { seen.add(base); groups.push(base) }
    }
    return groups.sort()
  }, [stations])

  const filteredPayments = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return scopedPayments.filter((p) => {
      if (selectedStation !== "all") {
        const base = p.stationId.replace(/c$/, "")
        if (base !== selectedStation) return false
      }
      if (!q) return true
      const station = stationById.get(p.stationId)
      return (station?.name?.toLowerCase().includes(q) || p.simNumber.includes(q) || p.provider.toLowerCase().includes(q))
    })
  }, [scopedPayments, selectedStation, searchTerm, stationById])

  const handleExport = () => {
    const exportData = filteredPayments.map((p) => {
      const station = stationById.get(p.stationId)
      return {
        สถานี: station?.name || p.stationId,
        "หมายเลข SIM": p.simNumber,
        ผู้ให้บริการ: p.provider,
        จำนวนเงิน: p.amount,
        วันครบกำหนด: formatThaiDate(new Date(p.dueDate)),
        สถานะ: p.status === "paid" ? "ชำระแล้ว" : "รอชำระ",
      }
    })
    exportToCSV(exportData, "sim-payments")
  }

  if (isLoading || stationsLoading) return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            จัดการซิม (SIM Payment Tracking) <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.3.4</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info.id • set_name • sim_info</p>
        </div>
        {canEditActivities(user) && (
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 font-bold" onClick={() => { setEditingPayment(undefined); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> เพิ่มรายการ
          </Button>
        )}
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="ค้นหาเบอร์ซิม, สถานี..." className="pl-8 h-8 bg-background text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="h-8 w-[160px] bg-background text-xs"><SelectValue placeholder="ทุกสถานี" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานี</SelectItem>
              {baseGroups.map(base => <SelectItem key={base} value={base}>{base}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-2" onClick={handleExport}><Download className="h-3 w-3" /> CSV</Button>
      </div>

      {/* 4. Payment Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" /> รายการซิมทั้งหมด
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">wimarc_info.set_name อ้างอิง</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left">สถานี</th>
                  <th className="p-3 text-left">wimarc_id</th>
                  <th className="p-3 text-left">เบอร์ซิม</th>
                  <th className="p-3 text-left">ผู้ให้บริการ</th>
                  <th className="p-3 text-right">ยอด (บ.)</th>
                  <th className="p-3 text-left">วันครบกำหนด</th>
                  <th className="p-3 text-center">สถานะ</th>
                  <th className="p-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium">
                {filteredPayments.map((p) => {
                  const station = stationById.get(p.stationId)
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-bold text-teal-900">{station?.name || p.stationId}</td>
                      <td className="p-3 font-mono opacity-60">{p.stationId}</td>
                      <td className="p-3 font-mono">{p.simNumber}</td>
                      <td className="p-3"><Badge variant="outline" className="text-[10px] uppercase">{p.provider}</Badge></td>
                      <td className="p-3 text-right font-mono font-bold">฿{p.amount.toLocaleString()}</td>
                      <td className="p-3 font-mono">{formatThaiDate(p.dueDate)}</td>
                      <td className="p-3 text-center">
                        {p.status === "paid"
                          ? <Badge className="bg-green-500 border-none text-[9px] h-4">ชำระแล้ว</Badge>
                          : <Badge className="bg-muted text-muted-foreground border-none text-[9px] h-4">รอชำระ</Badge>
                        }
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {p.status !== "paid" && canEditActivities(user) && (
                            <Button size="sm" className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-[10px] font-bold" onClick={() => handleMarkPaid(p)}>ชำระ</Button>
                          )}
                          {canEditActivities(user) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPayment(p); setShowForm(true); }}><Edit className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredPayments.length === 0 && <div className="py-12 text-center text-muted-foreground">ไม่มีรายการที่ตรงกับเงื่อนไข</div>}
        </CardContent>
      </Card>

      <PaymentFormDialog open={showForm} onOpenChange={setShowForm} stations={stations} payment={editingPayment} onSubmit={handleSubmit} />
    </div>
  )
}
