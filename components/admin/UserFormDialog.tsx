/**
 * User Form Dialog Component
 * Modal form for creating/editing users with role and permission assignment
 */

"use client"

import type React from "react"

import { useState, useEffect } from "react"
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

  // Toggle station permission
  const toggleStation = (stationId: string) => {
    setPermittedStationIds((prev) =>
      prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId],
    )
  }

  // Select all stations
  const selectAllStations = () => {
    setPermittedStationIds(stations.map((s) => s.id))
  }

  // Deselect all stations
  const deselectAllStations = () => {
    setPermittedStationIds([])
  }

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
                  {stations.map((station) => (
                    <div key={station.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`station-${station.id}`}
                        checked={permittedStationIds.includes(station.id)}
                        onCheckedChange={() => toggleStation(station.id)}
                      />
                      <Label htmlFor={`station-${station.id}`} className="cursor-pointer text-sm font-normal">
                        {station.name} ({station.area})
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
