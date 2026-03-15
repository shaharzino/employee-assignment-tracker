'use client'

import { useState, useEffect } from 'react'
import { fetchDeptBalances, fetchCrossAssignments, type DeptBalance, type CrossAssignmentRow } from '@/lib/queries/reports'
import { exportDailyReportCsv } from '@/lib/export/csv'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DURATION_LABELS } from '@/types'
import type { DurationType } from '@/types'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronRight, ChevronLeft, Download } from 'lucide-react'
import Link from 'next/link'

export default function WeeklyReportPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }) // Sunday
  )
  const [balances, setBalances] = useState<DeptBalance[]>([])
  const [crossRows, setCrossRows] = useState<CrossAssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterDept, setFilterDept] = useState('all')

  const start = weekStart.toISOString().split('T')[0]
  const end = endOfWeek(weekStart, { weekStartsOn: 0 }).toISOString().split('T')[0]

  useEffect(() => {
    setLoading(true)
    setFilterEmp('all')
    setFilterDept('all')
    Promise.all([fetchDeptBalances(start, end), fetchCrossAssignments(start, end)])
      .then(([b, c]) => { setBalances(b); setCrossRows(c) })
      .finally(() => setLoading(false))
  }, [start, end])

  const uniqueEmps = [...new Map(crossRows.map((r) => [r.employee_name, r.employee_name])).entries()].map(([k]) => k).sort()
  const uniqueDepts = [...new Map(crossRows.map((r) => [r.worked_dept_name, { name: r.worked_dept_name, color: r.worked_dept_color }])).entries()].map(([, v]) => v)
  const filteredRows = crossRows.filter((r) =>
    (filterEmp === 'all' || r.employee_name === filterEmp) &&
    (filterDept === 'all' || r.worked_dept_name === filterDept)
  )

  const weekLabel = `${format(new Date(start + 'T12:00:00'), 'd/M', { locale: he })} – ${format(new Date(end + 'T12:00:00'), 'd/M/yyyy', { locale: he })}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח שבועי</h1>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily" className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <span className="text-foreground font-medium">שבועי</span>
            <span>|</span>
            <Link href="/reports/monthly" className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <Link href="/reports/quarterly" className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
            <span>|</span>
            <Link href="/reports/dept" className="hover:text-foreground">מחלקתי</Link>
          </nav>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 min-w-32 text-center">{weekLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportDailyReportCsv(crossRows, start)} disabled={loading}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען...</div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">סיכום מחלקות</CardTitle></CardHeader>
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
                    {balances.filter((b) => b.borrowed > 0 || b.lent > 0).map((b) => (
                      <tr key={b.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.color_hex }} />
                            {b.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums text-blue-600">{b.borrowed > 0 ? `+${b.borrowed}` : '—'}</td>
                        <td className="px-4 py-3 text-end tabular-nums text-red-500">{b.lent > 0 ? `-${b.lent}` : '—'}</td>
                        <td className="px-4 py-3 text-end tabular-nums font-semibold">
                          <span className={b.net_balance > 0 ? 'text-emerald-600' : b.net_balance < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                            {b.net_balance > 0 ? '+' : ''}{b.net_balance}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {balances.filter((b) => b.borrowed > 0 || b.lent > 0).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">אין שיוכים צולבים בשבוע זה</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {crossRows.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">פירוט שיוכים</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={filterEmp}
                      onChange={(e) => setFilterEmp(e.target.value)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="all">כל העובדים</option>
                      {uniqueEmps.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      <option value="all">כל המחלקות</option>
                      {uniqueDepts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">עבד ב</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">תאריך</th>
                        <th className="px-4 py-3 text-start font-medium text-muted-foreground">משמרת</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{row.employee_name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.home_dept_name}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: row.worked_dept_color }}>
                              {row.worked_dept_name}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground tabular-nums">{row.work_date.split('-').reverse().join('/')}</td>
                          <td className="px-4 py-2">
                            <Badge variant="secondary" className="text-xs">{DURATION_LABELS[row.duration as DurationType]}</Badge>
                          </td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">אין תוצאות לפילטר הנוכחי</td></tr>
                      )}
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
