"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { getAllActivities, getActivityTypes } from "@/services/activityService"
import { getAllStations } from "@/services/stationsService"
import type { PlotActivity, Station } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatThaiDate, formatThaiDateTime } from "@/utils/dateUtils"
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, 
  History, Settings, Image as ImageIcon, MapPin, User, Info,
  Droplets, Leaf, Scissor, Beaker, Grapes, Wrench, FileText
} from "lucide-react"
import { ActivityFormDialog, type ActivityFormData } from "@/components/activities/ActivityFormDialog"
import { ActivityModal } from "@/components/activities/ActivityModal"
import { Skeleton } from "@/components/ui/skeleton"

const TYPE_CONFIG: Record<string, { icon: any, color: string, bg: string, text: string }> = {
  "รดน้ำ":      { icon: Droplets, color: "#3b82f6", bg: "bg-blue-50", text: "text-blue-700" },
  "ใส่ปุ๋ย":    { icon: Leaf,     color: "#22c55e", bg: "bg-green-50", text: "text-green-700" },
  "ตัดแต่งกิ่ง": { icon: Scissor,  color: "#f59e0b", bg: "bg-yellow-50", text: "text-yellow-700" },
  "พ่นยา":      { icon: Beaker,   color: "#ef4444", bg: "bg-red-50", text: "text-red-700" },
  "เก็บเกี่ยว":  { icon: Grapes,   color: "#d97706", bg: "bg-orange-50", text: "text-orange-700" },
  "บำรุงรักษา":  { icon: Wrench,   color: "#7c3aed", bg: "bg-purple-50", text: "text-purple-700" },
  "อื่นๆ":      { icon: FileText, color: "#64748b", bg: "bg-slate-50", text: "text-slate-700" },
}

export default function CalendarPage() {
  const { user } = useAuth()
  const { permittedStations } = useStation()
  const [activities, setActivities] = useState<PlotActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [stationFilter, setStationFilter] = useState("all")
  
  // Modals
  const [formOpen, setFormOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<PlotActivity | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const data = await getAllActivities()
      setActivities(data)
      setIsLoading(false)
    }
    loadData()
  }, [])

  // ── CALENDAR LOGIC ──────────────────────────────
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()
    
    const days = []
    // Prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i
      days.push({ day: d, month: month - 1, year, isOtherMonth: true })
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month, year, isOtherMonth: false })
    }
    // Next month days
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: month + 1, year, isOtherMonth: true })
    }
    return days.map(d => {
      const date = new Date(d.year, d.month, d.day)
      return { ...d, dateStr: date.toISOString().split("T")[0] }
    })
  }, [currentDate])

  const activitiesByDate = useMemo(() => {
    const map: Record<string, PlotActivity[]> = {}
    activities.forEach(a => {
      const d = new Date(a.date).toISOString().split("T")[0]
      if (!map[d]) map[d] = []
      map[d].push(a)
    })
    return map
  }, [activities])

  const filteredActivities = useMemo(() => {
    if (stationFilter === "all") return activitiesByDate[selectedDate] || []
    return (activitiesByDate[selectedDate] || []).filter(a => a.stationId === stationFilter)
  }, [activitiesByDate, selectedDate, stationFilter])

  const monthSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    activities.forEach(a => {
      const d = new Date(a.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        counts[a.activityType] = (counts[a.activityType] || 0) + 1
      }
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [activities, currentDate])

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1))
  }

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr)
  }

  if (isLoading) return <div className="p-8"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-[600px] w-full" /></div>

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            ปฏิทินกิจกรรมแปลงเพาะปลูก <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.5</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">บันทึกและติดตามกิจกรรมสวนทุเรียน 30 สถานี</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> บันทึกกิจกรรม
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="bg-muted/50 border mb-4">
          <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" /> ปฏิทิน</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> ประวัติกิจกรรม</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2"><Settings className="h-4 w-4" /> บำรุงรักษา</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2"><ImageIcon className="h-4 w-4" /> แกลเลอรี</TabsTrigger>
        </TabsList>

        {/* ══ TAB: CALENDAR ══════════════════════════════ */}
        <TabsContent value="calendar" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-4">
            {/* Main Calendar Grid */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-md border-0 overflow-hidden">
                <div className="bg-teal-900 text-white p-4 flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="text-teal-400 hover:bg-teal-800" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
                  <h2 className="font-bold text-lg">
                    {currentDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-teal-800 border-teal-700 text-teal-200" onClick={() => setCurrentDate(new Date())}>วันนี้</Button>
                    <Button variant="ghost" size="icon" className="text-teal-400 hover:bg-teal-800" onClick={() => changeMonth(1)}><ChevronRight /></Button>
                  </div>
                </div>

                {/* Station Filter Bar */}
                <div className="bg-teal-800/90 p-3 px-4 flex items-center justify-between flex-wrap gap-4 border-b border-teal-700">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-teal-200/60 tracking-wider">สถานี:</span>
                    <Select value={stationFilter} onValueChange={setStationFilter}>
                      <SelectTrigger className="h-8 w-[200px] bg-teal-900/50 border-teal-600 text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด (ทุกสถานี)</SelectItem>
                        {permittedStations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {Object.entries(TYPE_CONFIG).slice(0, 6).map(([label, cfg]) => (
                      <div key={label} className="flex items-center gap-1 text-[10px] text-teal-100/70 whitespace-nowrap">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }}></div> {label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-7 bg-muted/30 border-b">
                  {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day, i) => (
                    <div key={day} className={`p-2 text-center text-[10px] font-bold uppercase tracking-widest ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 border-l border-t divide-x divide-y">
                  {calendarDays.map((d, i) => {
                    const isSelected = d.dateStr === selectedDate
                    const isToday = d.dateStr === new Date().toISOString().split("T")[0]
                    const dayActs = activitiesByDate[d.dateStr] || []
                    const filteredDayActs = stationFilter === "all" ? dayActs : dayActs.filter(a => a.stationId === stationFilter)

                    return (
                      <div 
                        key={i} 
                        className={`min-h-[110px] p-1.5 transition-colors cursor-pointer relative group ${d.isOtherMonth ? "bg-muted/10 opacity-30" : "hover:bg-teal-50/50"} ${isSelected ? "bg-teal-50 ring-2 ring-inset ring-teal-500 z-10" : ""}`}
                        onClick={() => handleDayClick(d.dateStr)}
                      >
                        <div className={`text-[11px] font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-teal-600 text-white" : d.month !== currentDate.getMonth() ? "text-muted-foreground" : "text-foreground"}`}>
                          {d.day}
                        </div>
                        <div className="space-y-0.5">
                          {filteredDayActs.slice(0, 3).map((a, idx) => {
                            const cfg = TYPE_CONFIG[a.activityType] || TYPE_CONFIG["อื่นๆ"]
                            return (
                              <div key={idx} className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold truncate border flex items-center gap-1 ${cfg.bg} ${cfg.text} border-current/20 shadow-sm`}>
                                <cfg.icon className="h-2 w-2 shrink-0" /> {a.activityType}
                              </div>
                            )
                          })}
                          {filteredDayActs.length > 3 && (
                            <div className="text-[8px] text-muted-foreground font-bold pl-1">+{filteredDayActs.length - 3} รายการ</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Month Summary Bar */}
              <Card className="shadow-md border-t-4 border-t-teal-500">
                <CardHeader className="py-3 bg-muted/30 border-b">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">สรุปกิจกรรมเดือนนี้</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {monthSummary.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground italic">ไม่มีกิจกรรมในเดือนนี้</div>
                  ) : monthSummary.map(([type, count]) => {
                    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG["อื่นๆ"]
                    const total = monthSummary.reduce((acc, curr) => acc + curr[1], 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={type} className="flex items-center gap-3 group cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.text}`}><cfg.icon className="h-4 w-4" /></div>
                        <div className="flex-1">
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span>{type}</span>
                            <span style={{ color: cfg.color }}>{count} ครั้ง ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all group-hover:brightness-110" style={{ width: `${pct}%`, backgroundColor: cfg.color }}></div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Side Panel: Day Detail */}
            <div className="space-y-4">
              <Card className="shadow-md border-0 overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="bg-teal-900 text-white p-4">
                  <h3 className="font-bold text-sm">
                    {new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h3>
                  <p className="text-[10px] text-teal-300 mt-1 uppercase font-bold tracking-tight">
                    {filteredActivities.length} กิจกรรม | {stationFilter === "all" ? "ทุกสถานี" : stationFilter}
                  </p>
                </div>
                <CardContent className="p-4 flex-1 overflow-y-auto max-h-[600px]">
                  {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-20">
                      <Leaf className="h-16 w-16 mb-4" />
                      <p className="text-sm font-bold uppercase tracking-widest">ยังไม่มีกิจกรรมวันนี้</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredActivities.map((a) => {
                        const cfg = TYPE_CONFIG[a.activityType] || TYPE_CONFIG["อื่นๆ"]
                        return (
                          <div 
                            key={a.id} 
                            className="p-3 bg-muted/30 border rounded-lg hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => { setSelectedActivity(a); setViewOpen(true); }}
                          >
                            <div className="flex gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.text} group-hover:scale-105 transition-transform`}>
                                <cfg.icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-black text-teal-900">{a.activityType}</div>
                                <div className="text-[10px] text-muted-foreground font-bold truncate">📍 {a.stationId}</div>
                                <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{a.description}</p>
                              </div>
                            </div>
                            {a.images.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-1">
                                {a.images.map((img, idx) => (
                                  <img key={idx} src={img} alt="act" className="h-12 w-full object-cover rounded border" />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
                <Button className="rounded-none h-12 bg-teal-400 hover:bg-teal-300 text-teal-950 font-black uppercase text-[11px] tracking-widest" onClick={() => setFormOpen(true)}>
                  + บันทึกกิจกรรมวันนี้
                </Button>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Placeholder Tabs for History, Maintenance, Gallery */}
        <TabsContent value="history">
          <Card><CardContent className="py-20 text-center text-muted-foreground">ฟีเจอร์ประวัติกิจกรรม กำลังถูก Port จากระบบเดิม...</CardContent></Card>
        </TabsContent>
        <TabsContent value="maintenance">
          <Card><CardContent className="py-20 text-center text-muted-foreground">ฟีเจอร์บันทึกบำรุงรักษา กำลังถูก Port จากระบบเดิม...</CardContent></Card>
        </TabsContent>
        <TabsContent value="gallery">
          <Card><CardContent className="py-20 text-center text-muted-foreground">ฟีเจอร์แกลเลอรีรวม กำลังถูก Port จากระบบเดิม...</CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ActivityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        stations={permittedStations}
        onSubmit={async (data) => {
          console.log("Saving activity:", data)
          setFormOpen(false)
          // In real app, call createActivity and reload
        }}
      />
      <ActivityModal
        activity={selectedActivity}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />
    </div>
  )
}
