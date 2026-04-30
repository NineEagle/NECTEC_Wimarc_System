/**
 * Date utility functions for time range calculations and formatting
 */

import type { TimeRange } from "@/types"

/**
 * Get start date for a given time range
 * @param days - Number of days to go back (3, 7, 15, or 30)
 */
export function getStartDateForRange(days: TimeRange): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Format date to Thai locale string
 */
export function formatThaiDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

/**
 * Format date and time to Thai locale string
 */
export function formatThaiDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/**
 * Format date + time including seconds (Thai)
 */
export function formatThaiDateTimeSeconds(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

/**
 * Format time only
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/**
 * Calculate time difference in a human-readable format (Thai)
 */
export function getTimeDifference(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "เมื่อสักครู่"
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
  return `${diffDays} วันที่แล้ว`
}

/**
 * Get days until a future date (for SIM payment reminders)
 */
export function getDaysUntil(futureDate: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const future = new Date(futureDate)
  future.setHours(0, 0, 0, 0)

  const diffMs = future.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}
