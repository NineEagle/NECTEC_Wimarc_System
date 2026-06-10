/**
 * Plot Activity Management Page (กิจกรรมแปลงเพาะปลูก)
 * CRUD operations for agricultural activities
 * Supports image attachments (max 3 per activity)
 * Role-based permissions: Admin (all), User (permitted stations), Guest (read-only)
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllStations } from "@/services/stationsService";
import {
  getAllActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivityTypes,
} from "@/services/activityService";
import {
  getLiveData,
  getTodayImages,
  type HourlyImage,
} from "@/services/sensorService";
import { Calendar } from "@/components/ui/calendar";
import { th } from "date-fns/locale";
import { exportActivitiesToCSV } from "@/services/exportService";
import { getPermittedStations, canEditData } from "@/utils/permissions";
import type { Station, PlotActivity, LiveData } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityModal } from "@/components/activities/ActivityModal";
import {
  ActivityFormDialog,
  type ActivityFormData,
} from "@/components/activities/ActivityFormDialog";
import { formatThaiDate, formatThaiDateTime } from "@/utils/dateUtils";
import {
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Download,
  ImageIcon,
  Search,
  Filter,
  Camera,
  Activity,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
    รดน้ำ: "💧",
    ใส่ปุ๋ย: "🌿",
    ตัดแต่งกิ่ง: "✂️",
    พ่นยา: "🧪",
    เก็บเกี่ยว: "🍈",
    อื่นๆ: "📝",
  };
  return icons[type] || "📋";
};

export default function ActivitiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [permittedStations, setPermittedStations] = useState<Station[]>([]);
  const [activities, setActivities] = useState<PlotActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<PlotActivity[]>(
    [],
  );
  const [liveImages, setLiveImages] = useState<Record<string, LiveData>>({});
  const [nineAmImages, setNineAmImages] = useState<
    Record<string, HourlyImage | null>
  >({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStationFilter, setSelectedStationFilter] =
    useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");

  // Modals
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewActivity, setViewActivity] = useState<PlotActivity | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editActivity, setEditActivity] = useState<PlotActivity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);

  const [cameraOpen, setCameraOpen] = useState(true);

  const canEdit = canEditData(user);
  const activityTypes = getActivityTypes();
  const isAdmin = user?.role === "Admin";
  const showCameraGallery =
    isAdmin || permittedStations.filter((s) => s.type === "weather").length > 1;

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const stations = await getAllStations();
        setAllStations(stations);
        const permitted = getPermittedStations(user, stations);
        setPermittedStations(permitted);

        const allActivities = await getAllActivities();
        const permittedActivities = allActivities.filter((activity) =>
          permitted.some((station) => station.id === activity.stationId),
        );
        setActivities(permittedActivities);
        setFilteredActivities(permittedActivities);
      } catch (error) {
        console.error("Failed to load activities data", error);
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
          description: "โปรดลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  // Load 9 AM camera images per station (latest snapshot at hour 9)
  useEffect(() => {
    if (permittedStations.length === 0) return;
    const weatherCount = permittedStations.filter(
      (s) => s.type === "weather",
    ).length;
    if (user?.role !== "Admin" && weatherCount <= 1) return;
    const fetch9am = async () => {
      const wimarcNum = (id: string) =>
        parseInt(id.replace(/^wimarc/, "").replace(/c$/, ""), 10) || 0;
      const stationsToFetch =
        selectedStationFilter === "all"
          ? permittedStations
              .filter((s) => s.type === "weather")
              .sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id))
          : ([
              permittedStations.find(
                (s) => s.id === selectedStationFilter.replace(/c$/, ""),
              ),
            ].filter(Boolean) as Station[]);
      const result: Record<string, HourlyImage | null> = {};
      await Promise.all(
        stationsToFetch.map(async (station) => {
          try {
            const imgs = await getTodayImages(station.id);
            // Find image with hour exactly 9 (or closest after 9 AM if 9 itself missing)
            const nine =
              imgs.find((i) => i.timestamp.getHours() === 9) ??
              imgs
                .filter((i) => i.timestamp.getHours() >= 9)
                .sort(
                  (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
                )[0] ??
              null;
            result[station.id] = nine;
          } catch (e) {
            result[station.id] = null;
          }
        }),
      );
      setNineAmImages(result);
    };
    fetch9am();
    const id = setInterval(fetch9am, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(id);
  }, [selectedStationFilter, permittedStations]);

  // Local-date key (Bangkok timezone) — toISOString uses UTC which shifts the date
  const localDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Group activities by date (YYYY-MM-DD local) for calendar markers
  const activitiesByDate = useMemo(() => {
    const map: Record<string, PlotActivity[]> = {};
    for (const a of filteredActivities) {
      const key = localDateKey(new Date(a.date));
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [filteredActivities]);

  const selectedDateKey = localDateKey(selectedDate);
  const selectedDateActivities = activitiesByDate[selectedDateKey] ?? [];
  const daysWithActivities = useMemo(
    () =>
      Object.keys(activitiesByDate).map((k) => {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m - 1, d);
      }),
    [activitiesByDate],
  );

  // Apply filters
  useEffect(() => {
    let filtered = [...activities];
    if (searchQuery) {
      filtered = filtered.filter(
        (activity) =>
          activity.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          activity.activityType
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }
    if (selectedStationFilter !== "all") {
      // Match both main + client of same wimarc base (e.g. "wimarc11" matches "wimarc11" and "wimarc11c")
      const base = selectedStationFilter.replace(/c$/, "");
      filtered = filtered.filter(
        (activity) => activity.stationId.replace(/c$/, "") === base,
      );
    }
    if (selectedTypeFilter !== "all") {
      filtered = filtered.filter(
        (activity) => activity.activityType === selectedTypeFilter,
      );
    }
    setFilteredActivities(filtered);
  }, [searchQuery, selectedStationFilter, selectedTypeFilter, activities]);

  const handleViewActivity = (activity: PlotActivity) => {
    setViewActivity(activity);
    setViewModalOpen(true);
  };

  const handleCreateActivity = () => {
    setEditActivity(null);
    setFormModalOpen(true);
  };

  const handleCreateForDate = (date: Date) => {
    setSelectedDate(date);
    setEditActivity(null);
    setFormModalOpen(true);
  };

  const handleEditActivity = (activity: PlotActivity) => {
    setEditActivity(activity);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (data: ActivityFormData) => {
    // Parse YYYY-MM-DD as local-noon (avoids UTC midnight shifting back a day in Bangkok)
    const [y, m, d] = data.date.split("-").map(Number);
    const safeDate = new Date(y, m - 1, d, 12, 0, 0);
    try {
      if (editActivity) {
        await updateActivity(editActivity.id, {
          stationId: data.stationId,
          date: safeDate,
          activityType: data.activityType,
          description: data.description,
          images: data.images,
        });
        toast({
          title: "บันทึกสำเร็จ",
          description: "แก้ไขกิจกรรมเรียบร้อยแล้ว",
        });
      } else {
        await createActivity({
          stationId: data.stationId,
          date: safeDate,
          activityType: data.activityType,
          description: data.description,
          createdBy: user!.id,
          createdByName: user!.fullName,
          images: data.images,
        });
        toast({
          title: "บันทึกสำเร็จ",
          description: "เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว",
        });
      }

      const allActivities = await getAllActivities();
      const permittedActivities = allActivities.filter((activity) =>
        permittedStations.some((station) => station.id === activity.stationId),
      );
      setActivities(permittedActivities);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกกิจกรรมได้",
      });
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    setDeleteActivityId(activityId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteActivityId) return;
    try {
      await deleteActivity(deleteActivityId);
      toast({ title: "ลบสำเร็จ", description: "ลบกิจกรรมเรียบร้อยแล้ว" });
      const allActivities = await getAllActivities();
      const permittedActivities = allActivities.filter((activity) =>
        permittedStations.some((station) => station.id === activity.stationId),
      );
      setActivities(permittedActivities);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบกิจกรรมได้",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteActivityId(null);
    }
  };

  const handleExport = () => {
    exportActivitiesToCSV(filteredActivities);
    toast({
      title: "ดาวน์โหลดสำเร็จ",
      description: "ส่งออกข้อมูลเป็น CSV เรียบร้อยแล้ว",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            กิจกรรมแปลง
            {/* <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">
              TOR 4.5.5.7
            </span> */}
          </h1>
          {/* <p className="text-xs text-muted-foreground font-mono hidden sm:block">
            Table: CAM_main.img_path • CAM_client • activities
          </p> */}
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 shrink-0"
            onClick={handleCreateActivity}
          >
            <Plus className="mr-1.5 h-4 w-4" />{" "}
            <span className="hidden xs:inline">บันทึก</span>กิจกรรม
          </Button>
        )}
      </div>

      {/* 2. Selector Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 border shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-muted-foreground uppercase">สถานี:</span>
          <Select
            value={selectedStationFilter}
            onValueChange={setSelectedStationFilter}
          >
            <SelectTrigger
              className="bg-background flex-1 min-w-0"
              style={{ height: 32 }}
            >
              <SelectValue placeholder="เลือกสถานี" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {isAdmin ? "สถานีทั้งหมด" : "ทุกสถานีที่ได้รับอนุญาต"}
              </SelectItem>
              {permittedStations
                .filter((s) => s.type === "weather")
                .sort(
                  (a, b) =>
                    (parseInt(a.id.replace(/^wimarc/, ""), 10) || 0) -
                    (parseInt(b.id.replace(/^wimarc/, ""), 10) || 0),
                )
                .map((station) => {
                  const owner = station.name.split("—")[1]?.trim();
                  return (
                    <SelectItem key={station.id} value={station.id}>
                      {station.id}
                      {owner ? ` — ${owner}` : ""}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-muted-foreground uppercase">ประเภท:</span>
          <Select
            value={selectedTypeFilter}
            onValueChange={setSelectedTypeFilter}
          >
            <SelectTrigger
              className="bg-background flex-1 min-w-0"
              style={{ height: 32 }}
            >
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {activityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            className="h-8 font-bold gap-2"
            onClick={handleExport}
            disabled={filteredActivities.length === 0}
          >
            <Download className="h-3 w-3" /> ดาวน์โหลด CSV
          </Button>
        </div>
      </div>

      {/* 3. Station Camera (snapshot at 9 AM) — hidden for users with a single station */}
      {showCameraGallery && (
        <Card className="shadow-sm border overflow-hidden">
          <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
              <Camera className="h-3.5 w-3.5" /> ภาพถ่ายจากสถานี — 09:00 น.{" "}
              <span className="font-normal opacity-50 ml-2 hidden sm:inline">
                TOR 4.5.5.2
              </span>
            </CardTitle>
            <button
              onClick={() => setCameraOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-muted"
            >
              {cameraOpen ? "ยุบ" : "ขยาย"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${cameraOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CardHeader>
          {cameraOpen && (
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.keys(nineAmImages).length > 0 ? (
                  Object.entries(nineAmImages).map(([stationId, img]) => {
                    const station = permittedStations.find(
                      (s) => s.id === stationId,
                    );
                    return (
                      <div
                        key={stationId}
                        className="relative aspect-[4/3] rounded-md overflow-hidden border shadow-sm group cursor-pointer"
                      >
                        {img ? (
                          <>
                            <img
                              src={img.imageUrl}
                              alt={`9am ${stationId}`}
                              className="object-cover w-full h-full transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2">
                              <div className="text-[10px] text-white font-bold uppercase truncate">
                                {station?.name || stationId}
                              </div>
                              <div className="text-[8px] text-white/80 font-mono">
                                {img.timestamp.toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-muted/40 flex flex-col items-center justify-center text-muted-foreground/50">
                            <Camera className="h-6 w-6 mb-1 opacity-50" />
                            <span className="text-[10px] truncate px-1">
                              {station?.name || stationId}
                            </span>
                            <span className="text-[8px] italic">
                              ไม่มีรูป 09:00
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 flex flex-col items-center justify-center text-muted-foreground/50">
                    <Camera className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs font-bold tracking-tighter">
                      กำลังโหลด...
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 4. Calendar + Selected Day Activities (TOR 4.5.5.4) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Calendar */}
        <Card className="shadow-sm border-l-4 border-l-teal-500">
          <CardHeader className="py-3 bg-muted/20 border-b">
            <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> ปฏิทินกิจกรรม
              {/* <span className="text-[10px] font-mono font-normal text-muted-foreground/50 ml-auto">
                TOR 4.5.5.4
              </span> */}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              modifiers={{ hasActivity: daysWithActivities }}
              modifiersClassNames={{
                hasActivity: "bg-teal-100 font-bold text-teal-800",
              }}
              locale={th}
              className="rounded-md w-full [&_button]:text-base [&_.rdp-weekday]:text-sm"
            />
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-teal-100 border border-teal-300"></span>{" "}
                วันที่มีกิจกรรม
              </div>
              <div>กดวันที่เพื่อดู/เพิ่มกิจกรรม</div>
            </div>
          </CardContent>
        </Card>

        {/* Selected day */}
        <Card className="shadow-sm border-t-4 border-t-teal-500">
          <CardHeader className="py-3 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="font-bold flex items-center gap-2">
              <span className="text-teal-700">
                {formatThaiDate(selectedDate)}
              </span>
              <Badge variant="outline" className="text-[14px]">
                {selectedDateActivities.length} กิจกรรม
              </Badge>
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 h-8 text-xs gap-1"
                onClick={() => handleCreateForDate(selectedDate)}
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มกิจกรรมวันนี้
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedDateActivities.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                ไม่มีกิจกรรมวันนี้{" "}
                {canEdit && <span>— กดปุ่ม "เพิ่มกิจกรรม" เพื่อบันทึก</span>}
              </div>
            ) : (
              selectedDateActivities.map((activity) => {
                const station = allStations.find(
                  (s) => s.id === activity.stationId,
                );
                return (
                  <Card
                    key={activity.id}
                    className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-teal-400 overflow-hidden"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl bg-teal-50 w-10 h-10 flex items-center justify-center rounded-full shrink-0 border border-teal-100">
                          {getActivityIcon(activity.activityType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-teal-600 hover:bg-teal-700 h-8 px-2 text-[14px] uppercase font-bold">
                                  {activity.activityType}
                                </Badge>
                                <span className="text-[14px] font-bold text-foreground">
                                  {station?.name || activity.stationId}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                                {activity.description}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    handleViewActivity(activity);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                                </DropdownMenuItem>
                                {canEdit && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        handleEditActivity(activity);
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" /> แก้ไข
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        handleDeleteActivity(activity.id);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> ลบ
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {activity.images.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {activity.images.map((img, i) => (
                                <div
                                  key={i}
                                  className="w-14 h-14 rounded border overflow-hidden cursor-pointer hover:opacity-80"
                                  onClick={() => handleViewActivity(activity)}
                                >
                                  <img
                                    src={img}
                                    alt="Activity"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-[12px] text-muted-foreground mt-2 font-mono opacity-70">
                            👤 {activity.createdByName}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <ActivityModal
        activity={viewActivity}
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        canDownload={
          viewActivity
            ? permittedStations.some(
                (s) =>
                  s.id.replace(/c$/, "") ===
                  viewActivity.stationId.replace(/c$/, ""),
              )
            : false
        }
      />
      <ActivityFormDialog
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        onSubmit={handleFormSubmit}
        stations={permittedStations}
        editActivity={editActivity}
        defaultDate={selectedDate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
