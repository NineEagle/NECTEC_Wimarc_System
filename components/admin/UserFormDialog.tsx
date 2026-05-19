/**
 * User Form Dialog Component
 * Modal form for creating/editing users with role and permission assignment
 */

"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Eye, EyeOff } from "lucide-react"
import type { User, UserRole, Station } from "@/types"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getRoleDisplayName } from "@/utils/permissions"

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: UserFormData) => Promise<void>
  stations: Station[]
  editUser?: User | null
}

export interface UserFormData {
  username: string
  password: string
  fullName: string
  email: string
  role: UserRole
  permittedStationIds: string[]
}

const fmtBaseId = (id: string) => {
  const m = id.match(/^wimarc(\d+)$/i)
  return m ? `Wimarc${String(m[1]).padStart(2, "0")}` : id
}

export function UserFormDialog({ open, onOpenChange, onSubmit, stations, editUser }: UserFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("User")
  const [permittedStationIds, setPermittedStationIds] = useState<string[]>([])

  const roles: UserRole[] = ["Admin", "User", "Guest"]

  // Group stations by base ID (wimarc1 + wimarc1c → one entry), sorted numerically
  const baseGroups = useMemo(() => {
    const map = new Map<string, Station[]>()
    for (const s of stations) {
      const base = s.id.replace(/c$/, "")
      if (!map.has(base)) map.set(base, [])
      map.get(base)!.push(s)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (parseInt(a.replace(/^wimarc/, ""), 10) || 0) - (parseInt(b.replace(/^wimarc/, ""), 10) || 0))
      .map(([baseId, stns]) => {
        const primary = stns.find(s => s.type === "weather") ?? stns[0]
        return { baseId, ids: stns.map(s => s.id), ownerName: primary.ownerName, area: primary.area }
      })
  }, [stations])

  // Initialize form when editing
  useEffect(() => {
    if (editUser) {
      setUsername(editUser.username)
      setPassword("") // Don't show existing password
      setFullName(editUser.fullName)
      setEmail(editUser.email)
      setRole(editUser.role)
      setPermittedStationIds(editUser.permittedStationIds)
    } else {
      // Reset form for new user
      setUsername("")
      setPassword("")
      setFullName("")
      setEmail("")
      setRole("User")
      setPermittedStationIds([])
    }
  }, [editUser, open])

  // Toggle all stations in a base group
  const toggleBaseStation = (ids: string[]) => {
    const anyChecked = ids.some(id => permittedStationIds.includes(id))
    if (anyChecked) {
      setPermittedStationIds(prev => prev.filter(id => !ids.includes(id)))
    } else {
      setPermittedStationIds(prev => [...new Set([...prev, ...ids])])
    }
  }

  const selectAllStations = () => setPermittedStationIds(stations.map(s => s.id))
  const deselectAllStations = () => setPermittedStationIds([])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSubmit({
        username,
        password,
        fullName,
        email,
        role,
        permittedStationIds: role === "Admin" ? [] : permittedStationIds, // Admin gets all access
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to submit user", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</DialogTitle>
          <DialogDescription>กรอกข้อมูลผู้ใช้และกำหนดสิทธิ์การเข้าถึง</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">
              ชื่อผู้ใช้ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={!!editUser}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน {!editUser && <span className="text-destructive">*</span>}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editUser}
                placeholder={editUser ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : ""}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">
              ชื่อ-นามสกุล <span className="text-destructive">*</span>
            </Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              อีเมล <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">
              บทบาท <span className="text-destructive">*</span>
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)} required>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {getRoleDisplayName(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Station permissions (not for Admin) */}
          {role !== "Admin" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  สิทธิ์เข้าถึงสถานี <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllStations}>
                    เลือกทั้งหมด
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAllStations}>
                    ยกเลิกทั้งหมด
                  </Button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border p-4">
                <div className="space-y-3">
                  {baseGroups.map(({ baseId, ids, ownerName, area }) => (
                    <div key={baseId} className="flex items-center space-x-2">
                      <Checkbox
                        id={`station-${baseId}`}
                        checked={ids.some(id => permittedStationIds.includes(id))}
                        onCheckedChange={() => toggleBaseStation(ids)}
                      />
                      <Label htmlFor={`station-${baseId}`} className="cursor-pointer text-sm font-normal">
                        {fmtBaseId(baseId)}{ownerName ? ` — ${ownerName}` : ""}{area ? ` (${area})` : ""}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {permittedStationIds.length === 0 && (
                <p className="text-sm text-destructive">กรุณาเลือกสถานีอย่างน้อย 1 สถานี</p>
              )}
            </div>
          )}

          {role === "Admin" && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
              ผู้ดูแลระบบมีสิทธิ์เข้าถึงสถานีทั้งหมดโดยอัตโนมัติ
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSubmitting || (role !== "Admin" && permittedStationIds.length === 0)}>
              {isSubmitting ? "กำลังบันทึก..." : editUser ? "บันทึกการแก้ไข" : "เพิ่มผู้ใช้"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
