/**
 * Admin User Management Page (จัดการผู้ใช้งานระบบ)
 * Admin-only page for CRUD operations on users
 * Manage roles, permissions, and station access
 */

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { canAccessAdminPages, getRoleDisplayName } from "@/utils/permissions"
import { getAllUsers, createUser, updateUser, toggleUserStatus, deleteUser } from "@/services/userService"
import { clearApiCache, ApiError } from "@/services/apiClient"
import { getAllStations } from "@/services/stationsService"
import type { User, Station } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserFormDialog, type UserFormData } from "@/components/admin/UserFormDialog"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, MoreVertical, Edit, UserCheck, UserX, Users, ShieldCheck, Database, Key, Eye, EyeOff, ArrowRight, ArrowLeft, Clock, Globe, Trash2 } from "lucide-react"
import { formatThaiDate } from "@/utils/dateUtils"

export default function UsersManagementPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Tabs
  const [tab, setTab] = useState<"users" | "external" | "pending">("users")

  // Search
  const [searchQuery, setSearchQuery] = useState("")

  // Quick Add State
  const [quickName, setQuickName] = useState("")
  const [quickUser, setQuickUser] = useState("")
  const [quickPass, setQuickPass] = useState("")
  const [quickRole, setQuickRole] = useState<string>("User")
  const [showQuickPass, setShowQuickPass] = useState(false)

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    const loadData = async () => {
      try {
        const [u, s] = await Promise.all([getAllUsers(), getAllStations()])
        setUsers(u); setFilteredUsers(u); setStations(s); setLoadError(false)
      } catch {
        // A rejected request must not leave the page stuck on the skeleton.
        setLoadError(true)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user, router])

  useEffect(() => {
    const isWimarc = (u: User) => /wimarc/i.test(u.username) || (u.permittedStationIds?.length ?? 0) > 0
    let filtered = users
      .filter(u => {
        if (tab === "pending")  return !u.isEnabled
        if (tab === "external") return u.isEnabled && u.role === "Guest"
        return u.isEnabled && u.role !== "Guest"
      })
      .filter(u =>
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const wa = isWimarc(a) ? 0 : 1
        const wb = isWimarc(b) ? 0 : 1
        return wa - wb
      })
    setFilteredUsers(filtered)
  }, [searchQuery, users, tab])

  const handleQuickAdd = async () => {
    if (!quickName || !quickUser || !quickPass) {
      toast({ variant: "destructive", title: "ข้อมูลไม่ครบ", description: "กรุณากรอกข้อมูลให้ครบถ้วน" })
      return
    }
    try {
      await createUser({
        username: quickUser,
        password: quickPass,
        fullName: quickName,
        email: `${quickUser}@wimarc.com`,
        role: quickRole as any,
        isEnabled: true,
        permittedStationIds: [],
      })
      toast({ title: "เพิ่มผู้ใช้สำเร็จ", description: `เพิ่มผู้ใช้ ${quickUser} เรียบร้อยแล้ว` })
      setQuickName(""); setQuickUser(""); setQuickPass("")
      clearApiCache("/users")
      const usersData = await getAllUsers()
      setUsers(usersData)
    } catch (error) {
      toast({ variant: "destructive", title: "ผิดพลาด", description: "ไม่สามารถเพิ่มผู้ใช้ได้" })
    }
  }

  const handleEditUser = (user: User) => { setEditUser(user); setFormModalOpen(true); }

  const handleUpgradeToUser = async (u: User) => {
    try {
      await updateUser(u.id, { role: "User" } as any)
      clearApiCache("/users")
      toast({ title: "อัปเกรดแล้ว", description: `${u.fullName} — ย้ายไปแท็บผู้ใช้งานแล้ว` })
      setUsers(await getAllUsers())
    } catch {
      toast({ variant: "destructive", title: "ผิดพลาด" })
    }
  }

  const handleDowngradeToExternal = async (u: User) => {
    try {
      await updateUser(u.id, { role: "Guest" } as any)
      clearApiCache("/users")
      toast({ title: "ย้ายแล้ว", description: `${u.fullName} — ย้ายไปแท็บภายนอกแล้ว` })
      setUsers(await getAllUsers())
    } catch {
      toast({ variant: "destructive", title: "ผิดพลาด" })
    }
  }

  const handleFormSubmit = async (data: UserFormData) => {
    try {
      if (editUser) {
        const updates: any = { fullName: data.fullName, email: data.email, role: data.role, permittedStationIds: data.permittedStationIds, phone: data.phone }
        if (data.password) updates.password = data.password
        await updateUser(editUser.id, updates)
        toast({ title: "บันทึกสำเร็จ" })
      }
      clearApiCache("/users")
      const usersData = await getAllUsers()
      setUsers(usersData)
    } catch (error) {
      toast({ variant: "destructive", title: "ผิดพลาด" })
    }
  }

  const handleToggleStatus = async (u: User) => {
    if (u.id === user?.id) {
      toast({ variant: "destructive", title: "ไม่อนุญาต", description: "ไม่สามารถปิดใช้งานบัญชีของตัวเองได้" })
      return
    }
    try {
      await toggleUserStatus(u.id)
      clearApiCache("/users")
      toast({
        title: u.isEnabled ? "ย้ายไปรออนุมัติ" : "อนุมัติแล้ว",
        description: `${u.fullName} — ${u.isEnabled ? "ย้ายไปแท็บรออนุมัติ" : "ย้ายไปแท็บผู้ใช้งานแล้ว"}`,
      })
      const updated = await getAllUsers()
      setUsers(updated)
    } catch {
      toast({ variant: "destructive", title: "ผิดพลาด", description: "ไม่สามารถเปลี่ยนสถานะได้" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast({
        title: "ลบคำขอแล้ว",
        description: `${deleteTarget.fullName} — ผู้ใช้สมัครเข้ามาใหม่ด้วยชื่อผู้ใช้/อีเมลเดิมได้`,
      })
      setDeleteTarget(null)
      setUsers(await getAllUsers())
    } catch (e) {
      // The backend refuses (409) with a Thai reason when the account still has
      // data attached — surface it verbatim instead of a generic failure.
      toast({
        variant: "destructive",
        title: "ลบไม่สำเร็จ",
        description: e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getUserStations = (user: User) => {
    if (user.role === "Admin") return "ทั้งหมด"
    if (user.permittedStationIds.length === 0) return "ไม่มี"
    return user.permittedStationIds.map(id => stations.find(s => s.id === id)?.id || id).join(", ")
  }

  if (isLoading) return <div className="p-8 space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
  if (!canAccessAdminPages(user)) return null

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-12">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            จัดการผู้ใช้งานระบบ <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.8.2, 4.5.8.5</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: user_info (id • fullname • username • password • role • active)</p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          โหลดข้อมูลผู้ใช้/สถานีไม่สำเร็จ — ข้อมูลที่แสดงอาจไม่ครบ กรุณารีเฟรชหน้าอีกครั้ง
        </div>
      )}

      {/* 2. Quick Add Form (Parity with old Inline Form) */}
      <Card className="shadow-md border-t-4 border-t-teal-500 overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-2 text-teal-800">
            <Plus className="h-3.5 w-3.5" /> เพิ่มผู้ใช้ใหม่ <span className="font-normal opacity-50 ml-2">INSERT INTO user_info</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6 items-end">
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">ชื่อ-สกุล <span className="font-mono opacity-50 ml-1">fullname</span></Label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="ชื่อ นามสกุล" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">ชื่อผู้ใช้ <span className="font-mono opacity-50 ml-1">username</span></Label>
              <Input value={quickUser} onChange={e => setQuickUser(e.target.value)} placeholder="username" className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">รหัสผ่าน <span className="font-mono opacity-50 ml-1">password</span></Label>
              <div className="relative">
                <Key className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                <Input type={showQuickPass ? "text" : "password"} value={quickPass} onChange={e => setQuickPass(e.target.value)} placeholder="••••••" className="h-8 text-xs pl-7 pr-7" />
                <button type="button" onClick={() => setShowQuickPass(v => !v)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showQuickPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">ประเภท <span className="font-mono opacity-50 ml-1">role (A/U/G)</span></Label>
              <Select value={quickRole} onValueChange={setQuickRole}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin" className="text-xs">A — Admin</SelectItem>
                  <SelectItem value="User" className="text-xs">U — User</SelectItem>
                  <SelectItem value="Guest" className="text-xs">G — Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Button onClick={handleQuickAdd} className="w-full bg-teal-600 hover:bg-teal-700 h-8 text-[11px] font-bold uppercase tracking-wider gap-2">
                <Plus className="h-3.5 w-3.5" /> เพิ่มผู้ใช้ระบบ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b pb-3">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${tab === "users" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-3.5 w-3.5" />
            ผู้ใช้งาน
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === "users" ? "bg-teal-100 text-teal-700" : "bg-muted text-muted-foreground"}`}>
              {users.filter(u => u.isEnabled).length}
            </span>
          </button>
          <button
            onClick={() => setTab("external")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${tab === "external" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Globe className="h-3.5 w-3.5" />
            ภายนอก
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === "external" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
              {users.filter(u => u.isEnabled && u.role === "Guest").length}
            </span>
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${tab === "pending" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Clock className="h-3.5 w-3.5" />
            รออนุมัติ
            {users.filter(u => !u.isEnabled).length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === "pending" ? "bg-amber-100 text-amber-700" : "bg-amber-500 text-white"}`}>
                {users.filter(u => !u.isEnabled).length}
              </span>
            )}
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Database className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
          <Input placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-สกุล..." className="pl-8 h-8 bg-background text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-auto">{filteredUsers.length} รายการ</span>
      </div>

      {/* 4. Users Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            {tab === "users"    && <><Users className="h-4 w-4 text-teal-600" /> รายชื่อผู้ใช้งาน</>}
            {tab === "external" && <><Globe className="h-4 w-4 text-blue-500" /> ผู้ใช้ภายนอก (Guest)</>}
            {tab === "pending"  && <><Clock className="h-4 w-4 text-amber-500" /> คำขอสมัครสมาชิก (รออนุมัติ)</>}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">SELECT * FROM user_info</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">ชื่อ-สกุล</th>
                  <th className="p-3 text-left">username</th>
                  <th className="p-3 text-center">role</th>
                  {(tab === "users" || tab === "external") && <th className="p-3 text-left">สถานีที่เข้าถึง</th>}
                  <th className="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium">
                {filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono opacity-50">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-teal-900">{u.fullName}</div>
                      <div className="text-[9px] text-muted-foreground font-mono">{u.email}</div>
                    </td>
                    <td className="p-3 font-mono text-teal-600">{u.username}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[9px] font-bold h-5 ${u.role === "Admin" ? "border-red-200 text-red-700 bg-red-50" : u.role === "User" ? "border-teal-200 text-teal-700 bg-teal-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {u.role === "Admin" ? "A — Admin" : u.role === "User" ? "U — User" : "G — Guest"}
                      </Badge>
                    </td>
                    {(tab === "users" || tab === "external") && (
                      <td className="p-3">
                        <div className="max-w-[200px] truncate text-muted-foreground font-mono text-[10px]">
                          {getUserStations(u)}
                        </div>
                      </td>
                    )}
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        {tab === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-[11px] bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1"
                              onClick={() => handleToggleStatus(u)}
                            >
                              <UserCheck className="h-3 w-3" /> อนุมัติ
                              <ArrowRight className="h-3 w-3 opacity-60" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="ลบคำขอนี้"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : tab === "external" ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditUser(u)}>
                              <Edit className="h-3 w-3 text-teal-600" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3 w-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem
                                  onClick={() => handleUpgradeToUser(u)}
                                  className="text-teal-600 focus:text-teal-600"
                                >
                                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                                  ย้ายไปผู้ใช้งาน
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(u)}
                                  className="text-orange-600 focus:text-orange-600"
                                >
                                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                  ย้ายไปรออนุมัติ
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditUser(u)}>
                              <Edit className="h-3 w-3 text-teal-600" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3 w-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={u.id === user?.id}
                                  className={u.id === user?.id ? "opacity-40 cursor-not-allowed" : "text-orange-600 focus:text-orange-600"}
                                >
                                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                  ย้ายไปรออนุมัติ
                                  {u.id === user?.id && <span className="ml-2 text-[9px] text-muted-foreground">(บัญชีตัวเอง)</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDowngradeToExternal(u)}
                                  disabled={u.id === user?.id}
                                  className={u.id === user?.id ? "opacity-40 cursor-not-allowed" : "text-blue-600 focus:text-blue-600"}
                                >
                                  <Globe className="mr-2 h-3.5 w-3.5" />
                                  ย้ายไปภายนอก
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {tab === "pending"  ? "ไม่มีคำขอสมัครสมาชิกที่รออนุมัติ" :
               tab === "external" ? "ไม่มีผู้ใช้ภายนอก (Guest)" :
               "ไม่พบข้อมูลผู้ใช้"}
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog open={formModalOpen} onOpenChange={setFormModalOpen} onSubmit={handleFormSubmit} stations={stations} editUser={editUser} />

      {deleteTarget && (
        <AlertDialog open onOpenChange={() => !isDeleting && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบคำขอสมัครของ {deleteTarget.fullName}?</AlertDialogTitle>
              <AlertDialogDescription>
                ลบบัญชี <span className="font-mono">{deleteTarget.username}</span> ({deleteTarget.email}) ออกจากระบบถาวร
                ไม่กระทบข้อมูลสถานี กิจกรรม หรือ API key ใดๆ — และผู้ใช้รายนี้สมัครเข้ามาใหม่ด้วยชื่อผู้ใช้/อีเมลเดิมได้ทันที
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={(e) => { e.preventDefault(); handleDelete() }}
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันลบ"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
