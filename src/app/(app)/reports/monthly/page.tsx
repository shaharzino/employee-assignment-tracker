'use client'

import { useState, useEffect } from 'react'
import { fetchDeptBalances, fetchCrossAssignments, type DeptBalance, type CrossAssignmentRow } from '@/lib/queries/reports'
import { exportMonthlyReportCsv } from '@/lib/export/csv'
import { exportMonthlyReportPdf } from '@/lib/export/pdf'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DURATION_LABELS } from '@/types'
import type { DurationType } from '@/types'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

function getMonthRange(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const end = new Date(year, mon, 0).toISOString().split('T')[0]
  return { start, end }
}

export default function MonthlyReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [balances, setBalances] = useState<DeptBalance[]>([])
  const [crossRows, setCrossRows] = useState<CrossAssignmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { start, end } = getMonthRange(month)
    Promise.all([fetchDeptBalances(start, end), fetchCrossAssignments(start, end)])
      .then(([b, c]) => { setBalances(b); setCrossRows(c) })
      .finally(() => setLoading(false))
  }, [month])

  const monthLabel = format(new Date(month + '-01T12:00:00'), 'MMMM yyyy', { locale: he })
  const totalCross = crossRows.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח חודשי</h1>
          <p className="text-sm text-muted-foreground">{totalCross} שיוכים צולבים</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily" className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <Link href="/reports/weekly" className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <span className="text-foreground font-medium">חודשי</span>
            <span>|</span>
            <Link href="/reports/quarterly" className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
          </nav>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportMonthlyReportCsv(balances, crossRows, month)}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportMonthlyReportPdf(balances, crossRows, month)}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען דוח...</div>
      ) : (
        <>
          {/* Department balance table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">סיכום לפי מחלקה — {monthLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">שאלה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">השאילה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">יתרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => (
                      <tr key={b.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.color_hex }} />
                            <span className="font-medium">{b.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {b.borrowed > 0 ? <span className="text-blue-600">+{b.borrowed}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {b.lent > 0 ? <span className="text-red-600">-{b.lent}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <NetBadge value={b.net_balance} />
                        </td>
                      </tr>
                    ))}
                    {balances.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          אין שיוכים צולבים בחודש זה
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cross-assignment detail */}
          {crossRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">פירוט שיוכים צולבים</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם עובד</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">מ.ע</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">עבד ב</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">תאריך</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">משמרת</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossRows.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 font-medium">{row.employee_name}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{row.employee_number ?? '—'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.home_dept_name}</td>
                          <td className="px-4 py-2">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: row.worked_dept_color }}
                            >
                              {row.worked_dept_name}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground tabular-nums">
                            {row.work_date.split('-').reverse().join('/')}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="secondary" className="text-xs">
                              {DURATION_LABELS[row.duration as DurationType] ?? row.duration}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function NetBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground flex items-center justify-end gap-1"><Minus className="h-3 w-3" />0</span>
  if (value > 0) return (
    <span className="text-emerald-600 font-semibold flex items-center justify-end gap-1">
      <TrendingUp className="h-3 w-3" />+{value}
    </span>
  )
  return (
    <span className="text-red-500 font-semibold flex items-center justify-end gap-1">
      <TrendingDown className="h-3 w-3" />{value}
    </span>
  )
}
