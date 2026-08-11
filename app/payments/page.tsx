"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SimPaymentService } from "@/services/simPaymentService";
import { getAllStations } from "@/services/stationsService";
import type { SimPayment, Station } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PaymentFormDialog } from "@/components/payments/PaymentFormDialog";
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
import { Plus, Search, Download, Smartphone, Edit, Trash2 } from "lucide-react";
import { formatThaiDate } from "@/utils/dateUtils";
import { canEditActivities, isAdmin } from "@/utils/permissions";
import { exportToCSV } from "@/services/exportService";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [payments, setPayments] = useState<SimPayment[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<
    SimPayment | undefined
  >();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = async () => {
    try {
      const [stations, allPayments] = await Promise.all([
        getAllStations(),
        SimPaymentService.getPayments(),
      ]);
      setAllStations(stations);
      setPayments(allPayments);
      setLoadError(false);
    } catch {
      // Never leave the page on an endless skeleton — flag the failure instead.
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleSubmit = async (data: Partial<SimPayment>) => {
    try {
      if (editingPayment) {
        await SimPaymentService.updatePayment(editingPayment.id, data);
        toast({
          title: "บันทึกสำเร็จ",
          description: "แก้ไขรายการซิมเรียบร้อยแล้ว",
        });
      } else {
        await SimPaymentService.createPayment(data as Omit<SimPayment, "id">);
        toast({
          title: "เพิ่มสำเร็จ",
          description: "เพิ่มรายการซิมใหม่เรียบร้อยแล้ว",
        });
      }
      loadData();
      setEditingPayment(undefined);
    } catch {
      toast({
        variant: "destructive",
        title: "ผิดพลาด",
        description: "ไม่สามารถบันทึกข้อมูลได้",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await SimPaymentService.deletePayment(deleteId);
      toast({ title: "ลบสำเร็จ", description: "ลบรายการซิมเรียบร้อยแล้ว" });
      loadData();
    } catch {
      toast({
        variant: "destructive",
        title: "ผิดพลาด",
        description: "ไม่สามารถลบข้อมูลได้",
      });
    } finally {
      setDeleteId(null);
    }
  };

  // Station lookup (all stations)
  const stationById = useMemo(() => {
    const map = new Map<string, Station>();
    for (const s of allStations) map.set(s.id, s);
    return map;
  }, [allStations]);

  // Main stations only (wimarc1-30, no "c") for filter dropdown
  const mainStations = useMemo(
    () =>
      allStations
        .filter((s) => !s.id.endsWith("c"))
        .sort(
          (a, b) =>
            (parseInt(a.id.replace(/^wimarc/, ""), 10) || 0) -
            (parseInt(b.id.replace(/^wimarc/, ""), 10) || 0),
        ),
    [allStations],
  );

  // Scope by permission
  const scopedPayments = useMemo(() => {
    if (isAdmin(user)) return payments;
    const allowed = new Set(allStations.map((s) => s.id));
    return payments.filter((p) => allowed.has(p.stationId));
  }, [payments, allStations, user]);

  const filteredPayments = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return scopedPayments.filter((p) => {
      if (selectedStation !== "all") {
        const base = p.stationId.replace(/c$/, "");
        if (base !== selectedStation) return false;
      }
      if (!q) return true;
      const station = stationById.get(p.stationId);
      return (
        station?.name?.toLowerCase().includes(q) ||
        p.simNumber.includes(q) ||
        p.provider.toLowerCase().includes(q)
      );
    });
  }, [scopedPayments, selectedStation, searchTerm, stationById]);

  const handleExport = () => {
    exportToCSV(
      filteredPayments.map((p) => ({
        สถานี: stationById.get(p.stationId)?.name || p.stationId,
        "หมายเลข SIM": p.simNumber,
        ผู้ให้บริการ: p.provider,
        วันครบกำหนด: formatThaiDate(new Date(p.dueDate)),
        สถานะ: p.status === "paid" ? "ชำระแล้ว" : "รอชำระ",
        หมายเหตุ: p.notes || "",
      })),
      "sim-payments",
    );
  };

  const canEdit = canEditActivities(user);

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            จัดการซิม (SIM Payment Tracking)
            {/* <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.3.4</span> */}
          </h1>
          {/* <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info.id • set_name • sim_info</p> */}
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 font-bold"
            onClick={() => {
              setEditingPayment(undefined);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> เพิ่มรายการ
          </Button>
        )}
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <span className="text-sm font-medium text-destructive">
            โหลดข้อมูลไม่สำเร็จ — ข้อมูลที่แสดงอาจไม่เป็นปัจจุบัน
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={loadData}>
            ลองใหม่
          </Button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 sm:flex-wrap border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-1 sm:min-w-[300px]">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยเบอร์โทร หรือชื่อ"
              className="pl-8 h-8 bg-background w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedStation} onValueChange={setSelectedStation}>
            <SelectTrigger className="h-8 w-full sm:w-[180px] bg-background">
              <SelectValue placeholder="ทุกสถานี" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานี</SelectItem>
              {mainStations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 font-bold gap-2 w-full sm:w-auto justify-center"
          onClick={handleExport}
        >
          <Download className="h-3 w-3" /> ดาวน์โหลด CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />{" "}
            รายการซิมทั้งหมด
            <span className="font-normal opacity-50">
              ({filteredPayments.length} รายการ)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left">สถานี</th>
                  <th className="p-3 text-left">WIMARC_ID</th>
                  <th className="p-3 text-left">เบอร์ซิม</th>
                  <th className="p-3 text-left">ผู้ให้บริการ</th>
                  <th className="p-3 text-left">วันครบกำหนด</th>
                  {canEdit && <th className="p-3 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayments.map((p) => {
                  const station = stationById.get(p.stationId);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">{station?.name || p.stationId}</td>
                      <td className="p-3">{p.stationId}</td>
                      <td className="p-3">{p.simNumber}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="uppercase">
                          {p.provider}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {p.dueDate ? formatThaiDate(p.dueDate) : "—"}
                      </td>
                      {canEdit && (
                        <td className="p-3">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingPayment(p);
                                setShowForm(true);
                              }}
                            >
                              <Edit className="h-3 w-3 text-teal-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPayments.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              ไม่มีรายการที่ตรงกับเงื่อนไข
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        stations={allStations}
        payment={editingPayment}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบรายการซิมนี้?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
