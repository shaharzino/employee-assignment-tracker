'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchDeptReport, type DeptReportRow } from '@/lib/queries/dept-report'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Home } from 'lucide-react'
import Link from 'next/link'
import type { Department } from '@/types'

const PERIODS = [
  { label: 'חודש נוכחי', value: 'month' },
  { label: 'רבעון נוכחי', value: 'quarter' },
  { label: 'חצי שנה', value: 'half' },
  { label: 'שנה נוכחית', value: 'year' },
]

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  if (period === 'month') {
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = new Date(y, m, 0).toISOString().split('T')[0]
    return { start, end }
  }
  if (period === 'quarter') {
    const q = Math.ceil(m / 3)
    const startM = (q - 1) * 3 + 1
    const endM = q * 3
    return {
      start: `${y}-${String(startM).padStart(2, '0')}-01`,
      end: new Date(y, endM, 0).toISOString().split('T')[0],
    }
  }
  if (period === 'half') {
    const startM = m <= 6 ? 1 : 7
    const endM = m <= 6 ? 6 : 12
    return {
      start: `${y}-${String(startM).padStart(2, '0')}-01`,
      end: new Date(y, endM, 0).toISOString().split('T')[0],
    }
  }
  // year
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

function exportCsv(rows: DeptReportRow[], deptName: string, start: string, end: string) {
  const lines = [
    `דוח מחלקתי - ${deptName}`,
    `תקופה: ${start} עד ${end}`,
    '',
    'שם עובד,מ.עובד,מחלקת בית,סוג,ימים במחלקה,ימי עבודה כלליים,אחוז',
    ...rows.map((r) =>
      `${r.employeeName},${r.employeeNumber ?? ''},${r.homeDeptName},${r.isHome ? 'בית' : 'שאול'},${r.daysInDept},${r.totalWorkingDays},${r.percentage}%`
    ),
  ]
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dept-report-${deptName}-${start.slice(0, 7)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DeptReportPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState('')
  const [period, setPeriod] = useState('month')
  const [rows, setRows] = useState<DeptReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('departments').select('*').eq('is_active', true).order('name')
      .then(({ data }) => {
        setDepartments(data ?? [])
        if (data?.length) setSelectedDept(data[0].id)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedDept) return
    const { start, end } = getPeriodRange(period)
    setLoading(true)
    fetchDeptReport(selectedDept, start, end)
      .then(setRows)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [selectedDept, period])

  const { start, end } = getPeriodRange(period)
  const selectedDeptObj = departments.find((d) => d.id === selectedDept)

  const homeRows = rows.filter((r) => r.isHome)
  const borrowedRows = rows.filter((r) => !r.isHome)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח מחלקתי</h1>
          <p className="text-sm text-muted-foreground">מי עבד במחלקה ובאיזה חלקיות</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily" className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <Link href="/reports/weekly" className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <Link href="/reports/monthly" className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <Link href="/reports/quarterly" className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
            <span>|</span>
            <span className="text-foreground font-medium">מחלקתי</span>
          </nav>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading || rows.length === 0}
            onClick={() => exportCsv(rows, selectedDeptObj?.name ?? '', start, end)}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Period summary */}
      {selectedDeptObj && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedDeptObj.color_hex }} />
          <span className="font-medium text-foreground">{selectedDeptObj.name}</span>
          <span>—</span>
          <span>{start.split('-').reverse().join('/')} עד {end.split('-').reverse().join('/')}</span>
          {!loading && <span className="text-primary font-medium">{rows.length} עובדים</span>}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">מחשב...</div>
      ) : (
        <>
          {/* Stats summary */}
          {rows.length > 0 && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-primary">{rows.length}</div>
                  <div className="text-muted-foreground">עובדים סה״כ</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{homeRows.length}</div>
                  <div className="text-muted-foreground">עובדי בית</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{borrowedRows.length}</div>
                  <div className="text-muted-foreground">עובדים שאולים</div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                פירוט עובדים — {selectedDeptObj?.name} ({PERIODS.find((p) => p.value === period)?.label})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם עובד</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">מ.עובד</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">סוג</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">ימים במחלקה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">ימי עבודה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">אחוז</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 font-medium">{row.employeeName}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">{row.employeeNumber ?? '—'}</td>
                        <td className="px-4 py-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: row.homeDeptColor }}
                          >
                            {row.homeDeptName}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {row.isHome ? (
                            <Badge variant="outline" className="gap-1 text-green-700 border-green-500">
                              <Home className="h-3 w-3" />
                              בית
                            </Badge>
                          ) : (
                            <Badge variant="secondary">שאול</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-end tabular-nums font-medium">{row.daysInDept}</td>
                        <td className="px-4 py-2 text-end tabular-nums text-muted-foreground">{row.totalWorkingDays}</td>
                        <td className="px-4 py-2 text-end">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(row.percentage, 100)}%`,
                                  backgroundColor: selectedDeptObj?.color_hex ?? '#6B7280',
                                }}
                              />
                            </div>
                            <span className="tabular-nums font-medium w-10 text-end">{row.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          אין נתונים לתקופה זו
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
