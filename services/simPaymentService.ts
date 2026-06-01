import type { SimPayment, SimPaymentStatus } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { formatDateOnly, mapSimPayment } from "@/services/apiMappers"

// Service for managing SIM card payment tracking
export class SimPaymentService {
  // Get all payment records, optionally filtered
  static async getPayments(filters?: { stationId?: string; status?: SimPaymentStatus }): Promise<SimPayment[]> {
    const payments = await apiRequest<any[]>("/sim-payments", {
      query: {
        station_id: filters?.stationId,
        status: filters?.status,
      },
    })
    return payments.map(mapSimPayment)
  }

  // Get payment by ID
  static async getPaymentById(id: string): Promise<SimPayment | null> {
    const payments = await this.getPayments()
    return payments.find((payment) => payment.id === id) || null
  }

  // Create new payment record
  static async createPayment(data: Omit<SimPayment, "id">): Promise<SimPayment> {
    const payload = {
      station_id: data.stationId,
      station_name: data.stationName,
      sim_number: data.simNumber,
      provider: data.provider,
      amount: data.amount,
      due_date: formatDateOnly(data.dueDate),
      status: data.status,
      paid_date: data.paidDate ? formatDateOnly(data.paidDate) : null,
      notes: data.notes,
    }

    const payment = await apiRequest<any>("/sim-payments", {
      method: "POST",
      body: payload,
    })

    return mapSimPayment(payment)
  }

  // Update payment record
  static async updatePayment(id: string, data: Partial<SimPayment>): Promise<SimPayment | null> {
    const payload: Record<string, unknown> = {}

    if (data.stationId !== undefined) payload.station_id = data.stationId
    if (data.stationName !== undefined) payload.station_name = data.stationName
    if (data.simNumber !== undefined) payload.sim_number = data.simNumber
    if (data.provider !== undefined) payload.provider = data.provider
    if (data.amount !== undefined) payload.amount = data.amount
    if (data.dueDate !== undefined) payload.due_date = formatDateOnly(data.dueDate)
    if (data.status !== undefined) payload.status = data.status
    if (data.paidDate !== undefined) payload.paid_date = data.paidDate ? formatDateOnly(data.paidDate) : null
    if (data.notes !== undefined) payload.notes = data.notes

    try {
      const payment = await apiRequest<any>(`/sim-payments/${id}`, {
        method: "PUT",
        body: payload,
      })
      return mapSimPayment(payment)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null
      }
      throw error
    }
  }

  // Delete payment record
  static async deletePayment(id: string): Promise<void> {
    await apiRequest<void>(`/sim-payments/${id}`, { method: "DELETE" })
  }

  // Mark payment as paid
  static async markAsPaid(id: string, paymentDate: Date, notes?: string): Promise<SimPayment | null> {
    return this.updatePayment(id, {
      status: "paid",
      paidDate: paymentDate,
      notes,
    })
  }

  // Get upcoming payments (due within next 30 days)
  static getUpcomingPayments(payments: SimPayment[], stationId?: string): SimPayment[] {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return payments
      .filter((payment) => (stationId ? payment.stationId === stationId : true))
      .filter((payment) => payment.status === "pending")
      .filter((payment) => {
        const dueDate = new Date(payment.dueDate)
        return dueDate >= now && dueDate <= thirtyDaysFromNow
      })
  }

  // Get overdue payments
  static getOverduePayments(payments: SimPayment[], stationId?: string): SimPayment[] {
    const now = new Date()

    return payments
      .filter((payment) => (stationId ? payment.stationId === stationId : true))
      .filter((payment) => payment.status === "pending")
      .filter((payment) => new Date(payment.dueDate) < now)
  }

  // Calculate total amounts
  static getTotalAmounts(payments: SimPayment[]) {
    return payments.reduce(
      (acc, payment) => {
        acc.total += payment.amount
        if (payment.status === "paid") {
          acc.paid += payment.amount
        } else {
          acc.pending += payment.amount
        }
        return acc
      },
      { total: 0, paid: 0, pending: 0 },
    )
  }
}
