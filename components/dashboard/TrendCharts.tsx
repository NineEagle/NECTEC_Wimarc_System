"use client"

import { useEffect, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSensorReadings } from "@/services/sensorService"
import type { SensorReading } from "@/types"
import { Loader2, TrendingUp, Droplets, Activity } from "lucide-react"

interface TrendChartsProps {
  stationId: string
  isWeather?: boolean
}

export function TrendCharts({ stationId, isWeather = true }: TrendChartsProps) {
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Fetch last 24 hours (1 day)
        const data = await getSensorReadings(stationId, 1)
        setReadings(data)
      } catch (error) {
        console.error("Failed to load trend data", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [stationId])

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  }

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        กำลังโหลดข้อมูลแนวโน้ม 24 ชม...
      </div>
    )
  }

  if (readings.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground italic text-xs">
        ไม่มีข้อมูลพยากรณ์ย้อนหลัง 24 ชม.
      </div>
    )
  }

  return (
    <Tabs defaultValue="vpd" className="w-full">
      <div className="flex items-center justify-between px-4 pt-2">
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="vpd" className="text-[10px] uppercase font-bold">VPD Trend</TabsTrigger>
          <TabsTrigger value="temp_humid" className="text-[10px] uppercase font-bold">Temp/RH</TabsTrigger>
        </TabsList>
        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
           <TrendingUp className="h-3 w-3" /> Last 24h
        </div>
      </div>

      <TabsContent value="vpd" className="mt-0">
        <div className="h-[240px] w-full p-4 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={readings}>
              <defs>
                <linearGradient id="colorVpd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                interval="preserveStartEnd"
                minTickGap={30}
                fontSize={10}
                stroke="#94a3b8"
              />
              <YAxis fontSize={10} stroke="#94a3b8" />
              <Tooltip
                labelFormatter={(label) => formatTime(new Date(label))}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area
                type="monotone"
                dataKey="vpd"
                name="VPD (kPa)"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorVpd)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="temp_humid" className="mt-0">
        <div className="h-[240px] w-full p-4 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                fontSize={10}
                stroke="#94a3b8"
              />
              <YAxis yAxisId="left" fontSize={10} stroke="#f43f5e" />
              <YAxis yAxisId="right" orientation="right" fontSize={10} stroke="#0ea5e9" />
              <Tooltip
                labelFormatter={(label) => formatTime(new Date(label))}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="airTemperature"
                name="Temp (°C)"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="relativeHumidity"
                name="RH (%)"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  )
}
