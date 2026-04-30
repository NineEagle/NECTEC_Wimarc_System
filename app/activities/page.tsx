/**
 * Plot Activity Management Page (กิจกรรมแปลงเพาะปลูก)
 * CRUD operations for agricultural activities
 * Supports image attachments (max 3 per activity)
 * Role-based permissions: Admin (all), User (permitted stations), Guest (read-only)
 */

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { getAllStations } from "@/services/stationsService"
import {
  getAllActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivityTypes,
} from "@/services/activityService"
import { getLiveData } from "@/services/sensorService"
import { exportActivitiesToCSV } from "@/services/exportService"
import { getPermittedStations, canEditData } from "@/utils/permissions"
import type { Station, PlotActivity, LiveData } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ActivityModal } from "@/components/activities/ActivityModal"
import { ActivityFormDialog, type ActivityFormData } from "@/components/activities/ActivityFormDialog"
import { formatThaiDate, formatThaiDateTime } from "@/utils/dateUtils"
import { Plus, MoreVertical, Eye, Edit, Trash2, Download, ImageIcon, Search, Filter, Camera } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
    "รดน้ำ": "💧",
    "ใส่ปุ๋ย": "🌿",
    "ตัดแต่งกิ่ง": "✂️",
    "พ่นยา": "🧪",
    "เก็บเกี่ยว": "🍈",
    "อื่นๆ": "📝"
  }
  return icons[type] || "📋"
}

export default function ActivitiesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allStations, setAllStations] = useState<Station[]>([])
  const [permittedStations, setPermittedStations] = useState<Station[]>([])
  const [activities, setActivities] = useState<PlotActivity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<PlotActivity[]>([])
  const [currentStationLive, setCurrentStationLive] = useState<LiveData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>("all")
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all")

  // Modals
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewActivity, setViewActivity] = useState<PlotActivity | null>(null)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editActivity, setEditActivity] = useState<PlotActivity | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null)

  const canEdit = canEditData(user)
  const activityTypes = getActivityTypes()

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      const stations = await getAllStations()
      setAllStations(stations)
      const permitted = getPermittedStations(user, stations)
      setPermittedStations(permitted)

      const allActivities = await getAllActivities()
      const permittedActivities = allActivities.filter((activity) =>
        permitted.some((station) => station.id === activity.stationId),
      )
      setActivities(permittedActivities)
      setFilteredActivities(permittedActivities)

      setIsLoading(false)
    }

    loadData()
  }, [user])

  // Load live data for the selected station to show in gallery
  useEffect(() => {
    if (selectedStationFilter !== "all") {
      getLiveData(selectedStationFilter).then(setCurrentStationLive).catch(() => setCurrentStationLive(null))
    } else {
      setCurrentStationLive(null)
    }
  }, [selectedStationFilter])

  // Apply filters
  useEffect(() => {
    let filtered = [...activities]
    if (searchQuery) {
      filtered = filtered.filter(
        (activity) =>
          activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.activityType.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }
    if (selectedStationFilter !== "all") {
      filtered = filtered.filter((activity) => activity.stationId === selectedStationFilter)
    }
    if (selectedTypeFilter !== "all") {
      filtered = filtered.filter((activity) => activity.activityType === selectedTypeFilter)
    }
    setFilteredActivities(filtered)
  }, [searchQuery, selectedStationFilter, selectedTypeFilter, activities])

  const handleViewActivity = (activity: PlotActivity) => {
    setViewActivity(activity)
    setViewModalOpen(true)
  }

  const handleCreateActivity = () => {
    setEditActivity(null)
    setFormModalOpen(true)
  }

  const handleEditActivity = (activity: PlotActivity) => {
    setEditActivity(activity)
    setFormModalOpen(true)
  }

  const handleFormSubmit = async (data: ActivityFormData) => {
    try {
      if (editActivity) {
        await updateActivity(editActivity.id, {
          stationId: data.stationId,
          date: new Date(data.date),
          activityType: data.activityType,
          description: data.description,
          images: data.images,
        })
        toast({ title: "บันทึกสำเร็จ", description: "แก้ไขกิจกรรมเรียบร้อยแล้ว" })
      } else {
        await createActivity({
          stationId: data.stationId,
          date: new Date(data.date),
          activityType: data.activityType,
          description: data.description,
          createdBy: user!.id,
          createdByName: user!.fullName,
          images: data.images,
        })
        toast({ title: "บันทึกสำเร็จ", description: "เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว" })
      }

      const allActivities = await getAllActivities()
      const permittedActivities = allActivities.filter((activity) =>
        permittedStations.some((station) => station.id === activity.stationId),
      )
      setActivities(permittedActivities)
    } catch (error) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกกิจกรรมได้" })
    }
  }

  const handleDeleteActivity = (activityId: string) => {
    setDeleteActivityId(activityId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteActivityId) return
    try {
      await deleteActivity(deleteActivityId)
      toast({ title: "ลบสำเร็จ", description: "ลบกิจกรรมเรียบร้อยแล้ว" })
      const allActivities = await getAllActivities()
      const permittedActivities = allActivities.filter((activity) =>
        permittedStations.some((station) => station.id === activity.stationId),
      )
      setActivities(permittedActivities)
    } catch (error) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบกิจกรรมได้" })
    } finally {
      setDeleteDialogOpen(false)
      setDeleteActivityId(null)
    }
  }

  const handleExport = () => {
    exportActivitiesToCSV(filteredActivities)
    toast({ title: "ดาวน์โหลดสำเร็จ", description: "ส่งออกข้อมูลเป็น CSV เรียบร้อยแล้ว" })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            กิจกรรมแปลงเพาะปลูก & แกลเลอรี <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.5.7</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main.img_path • CAM_client • activities</p>
        </div>
        {canEdit && (
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateActivity}>
            <Plus className="mr-2 h-4 w-4" /> บันทึกกิจกรรม
          </Button>
        )}
      </div>

      {/* 2. Selector Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
        <div className="flex items-center gap-4 flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-bold text-muted-foreground text-xs uppercase">สถานี:</span>
            <Select value={selectedStationFilter} onValueChange={setSelectedStationFilter}>
              <SelectTrigger className="h-8 bg-background">
                <SelectValue placeholder="เลือกสถานี" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานีที่ได้รับอนุญาต</SelectItem>
                {permittedStations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="font-bold text-muted-foreground text-xs uppercase">ประเภท:</span>
            <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
              <SelectTrigger className="h-8 bg-background">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                {activityTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={filteredActivities.length === 0}>
            <Download className="mr-2 h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {/* 3. Station Camera Gallery (TOR 4.5.5.2) */}
      {selectedStationFilter !== "all" && (
        <Card className="shadow-sm border overflow-hidden">
          <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
              <Camera className="h-3.5 w-3.5" /> ภาพถ่ายจากสถานี <span className="font-normal opacity-50 ml-2">TOR 4.5.5.2</span>
            </CardTitle>
            <span className="text-[10px] font-mono opacity-50">CAM_main.img_path</span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentStationLive?.imageUrl ? (
                <div className="relative aspect-[4/3] rounded-md overflow-hidden border shadow-sm group cursor-pointer">
                  <img src={currentStationLive.imageUrl} alt="Live" className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <div className="text-[9px] text-white font-bold uppercase">ภาพล่าสุด</div>
                    <div className="text-[8px] text-white/80 font-mono">{formatThaiDateTime(currentStationLive.imageTime || new Date())}</div>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/3] rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground/30 bg-muted/10">
                  <Camera className="h-6 w-6 mb-1" />
                  <span className="text-[8px] uppercase font-bold tracking-tighter">No Recent Image</span>
                </div>
              )}
              {/* Placeholders for gallery logic */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-[4/3] rounded-md border bg-muted/20 flex items-center justify-center text-muted-foreground/20">
                  <ImageIcon className="h-5 w-5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Activity Log Feed (TOR 4.5.5.4) */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Activity className="h-3.5 w-3.5" /> บันทึกกิจกรรมแปลงเพาะปลูก
        </h2>
        {filteredActivities.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">ไม่พบกิจกรรมที่ตรงกับเงื่อนไข</CardContent></Card>
        ) : (
          filteredActivities.map((activity) => {
            const station = allStations.find((s) => s.id === activity.stationId)
            return (
              <Card key={activity.id} className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-teal-500 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl bg-teal-50 w-12 h-12 flex items-center justify-center rounded-full shrink-0 border border-teal-100">
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-teal-600 hover:bg-teal-700 h-5 px-2 text-[10px] uppercase font-bold">{activity.activityType}</Badge>
                            <span className="text-xs font-bold text-foreground">{station?.name || "ไม่ทราบสถานี"}</span>
                          </div>
                          <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed font-medium">{activity.description}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewActivity(activity)}><Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด</DropdownMenuItem>
                            {canEdit && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditActivity(activity)}><Edit className="mr-2 h-4 w-4" /> แก้ไข</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteActivity(activity.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> ลบ</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Thumbnails */}
                      {activity.images.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {activity.images.map((img, i) => (
                            <div key={i} className="w-16 h-16 rounded border overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleViewActivity(activity)}>
                              <img src={img} alt="Activity" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-3 font-mono border-t pt-2 opacity-70">
                        <span className="flex items-center gap-1">📍 {activity.stationId}</span>
                        <span className="flex items-center gap-1">👤 {activity.createdByName}</span>
                        <span className="flex items-center gap-1">📅 {formatThaiDate(activity.date)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <ActivityModal activity={viewActivity} open={viewModalOpen} onOpenChange={setViewModalOpen} />
      <ActivityFormDialog open={formModalOpen} onOpenChange={setFormModalOpen} onSubmit={handleFormSubmit} stations={permittedStations} editActivity={editActivity} />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
