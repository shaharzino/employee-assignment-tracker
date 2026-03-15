'use client'

import { useState, useEffect } from 'react'
import { fetchCrossAssignments, fetchDeptBalances, type CrossAssignmentRow, type DeptBalance } from '@/lib/queries/reports'
import { exportDailyReportCsv } from '@/lib/export/csv'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DURATION_LABELS } from '@/types'
import type { DurationType } from '@/types'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Download } from 'lucide-react'
import Link from 'next/link'

export default function DailyReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [crossRows, setCrossRows] = useState<CrossAssignmentRow[]>([])
  const [balances, setBalances] = useState<DeptBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCrossAssignments(date, date), fetchDeptBalances(date, date)])
      .then(([c, b]) => { setCrossRows(c); setBalances(b) })
      .finally(() => setLoading(false))
  }, [date])

  const dateLabel = format(new Date(date + 'T12:00:00'), 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח יומי</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">יומי</span>
            <span>|</span>
            <Link href="/reports/weekly" className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <Link href="/reports/monthly" className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <Link href="/reports/quarterly" className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
          </nav>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportDailyReportCsv(crossRows, date)} disabled={loading}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען...</div>
      ) : (
        <>
          {/* Summary by dept */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {balances.filter((b) => b.borrowed > 0 || b.lent > 0).map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.color_hex }} />
                    <span className="font-medium text-sm">{b.name}</span>
                  </div>
                  {b.borrowed > 0 && <p className="text-xs text-blue-600">שאלה: {b.borrowed} ימים</p>}
                  {b.lent > 0 && <p className="text-xs text-red-500">השאילה: {b.lent} ימים</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">שיוכים צולבים — {dateLabel}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם עובד</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">עבד ב</th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">משמרת</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossRows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{row.employee_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.home_dept_name}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: row.worked_dept_color }}>
                            {row.worked_dept_name}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className="text-xs">{DURATION_LABELS[row.duration as DurationType]}</Badge>
                        </td>
                      </tr>
                    ))}
                    {crossRows.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">אין שיוכים צולבים ביום זה</td></tr>
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
