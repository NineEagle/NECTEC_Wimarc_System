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
import { getAllUsers, createUser, updateUser, toggleUserStatus } from "@/services/userService"
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
import { Plus, MoreVertical, Edit, UserCheck, UserX, Users, ShieldCheck, Database, Key, Eye, EyeOff } from "lucide-react"
import { formatThaiDate } from "@/utils/dateUtils"

export default function UsersManagementPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    const loadData = async () => {
      const [u, s] = await Promise.all([getAllUsers(), getAllStations()])
      setUsers(u); setFilteredUsers(u); setStations(s); setIsLoading(false)
    }
    loadData()
  }, [user, router])

  useEffect(() => {
    let filtered = users.filter(u => 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

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
      const usersData = await getAllUsers()
      setUsers(usersData)
    } catch (error) {
      toast({ variant: "destructive", title: "ผิดพลาด", description: "ไม่สามารถเพิ่มผู้ใช้ได้" })
    }
  }

  const handleEditUser = (user: User) => { setEditUser(user); setFormModalOpen(true); }

  const handleFormSubmit = async (data: UserFormData) => {
    try {
      if (editUser) {
        const updates: any = { fullName: data.fullName, email: data.email, role: data.role, permittedStationIds: data.permittedStationIds, phone: data.phone }
        if (data.password) updates.password = data.password
        await updateUser(editUser.id, updates)
        toast({ title: "บันทึกสำเร็จ" })
      }
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
      toast({
        title: u.isEnabled ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว",
        description: `${u.fullName} — ${u.isEnabled ? "บัญชีถูกปิดใช้งาน" : "บัญชีเปิดใช้งานแล้ว"}`,
      })
      const updated = await getAllUsers()
      setUsers(updated)
    } catch {
      toast({ variant: "destructive", title: "ผิดพลาด", description: "ไม่สามารถเปลี่ยนสถานะได้" })
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

      {/* 3. Search Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between border shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Database className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
          <Input placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-สกุล..." className="pl-8 h-8 bg-background text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Found {filteredUsers.length} users</span>
      </div>

      {/* 4. Users Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> รายชื่อผู้ใช้ทั้งหมด
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">SELECT * FROM user_info</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left w-12">id</th>
                  <th className="p-3 text-left">fullname</th>
                  <th className="p-3 text-left">username</th>
                  <th className="p-3 text-center">type</th>
                  <th className="p-3 text-center">active</th>
                  <th className="p-3 text-left">สถานีที่เข้าถึง</th>
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
                    <td className="p-3 text-center">
                      <Badge className={`text-[9px] h-4 font-bold border-none ${u.isEnabled ? "bg-green-500" : "bg-red-400"}`}>
                        {u.isEnabled ? "เปิด" : "ปิด"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[200px] truncate text-muted-foreground font-mono text-[10px]">
                        {getUserStations(u)}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
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
                              className={u.id === user?.id ? "opacity-40 cursor-not-allowed" : u.isEnabled ? "text-orange-600 focus:text-orange-600" : "text-green-600 focus:text-green-600"}
                            >
                              {u.isEnabled ? <UserX className="mr-2 h-3.5 w-3.5" /> : <UserCheck className="mr-2 h-3.5 w-3.5" />}
                              {u.isEnabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                              {u.id === user?.id && <span className="ml-2 text-[9px] text-muted-foreground">(บัญชีตัวเอง)</span>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && <div className="py-12 text-center text-muted-foreground">ไม่พบข้อมูลผู้ใช้</div>}
        </CardContent>
      </Card>

      <UserFormDialog open={formModalOpen} onOpenChange={setFormModalOpen} onSubmit={handleFormSubmit} stations={stations} editUser={editUser} />
      
    </div>
  )
}
