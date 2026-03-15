'use client'

import { useState, useEffect } from 'react'
import { fetchDeptBalances, fetchCrossAssignments, type DeptBalance } from '@/lib/queries/reports'
import { exportMonthlyReportCsv } from '@/lib/export/csv'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

const QUARTERS = ['Q1 (ינו-מרץ)', 'Q2 (אפר-יוני)', 'Q3 (יול-ספט)', 'Q4 (אוק-דצמ)']

function getQuarterRange(year: number, q: number) {
  const startMonth = (q - 1) * 3 + 1
  const endMonth = q * 3
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = new Date(year, endMonth, 0)
  const end = endDate.toISOString().split('T')[0]
  return { start, end }
}

export default function QuarterlyReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [balances, setBalances] = useState<DeptBalance[]>([])
  const [crossCount, setCrossCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const { start, end } = getQuarterRange(year, quarter)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDeptBalances(start, end), fetchCrossAssignments(start, end)])
      .then(([b, c]) => { setBalances(b); setCrossCount(c.length) })
      .finally(() => setLoading(false))
  }, [start, end])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח רבעוני</h1>
          <p className="text-sm text-muted-foreground">{QUARTERS[quarter - 1]} {year} — {crossCount} שיוכים צולבים</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily" className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <Link href="/reports/weekly" className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <Link href="/reports/monthly" className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <span className="text-foreground font-medium">רבעוני</span>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
          </nav>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {QUARTERS.map((q, i) => (
              <option key={i + 1} value={i + 1}>{q}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              const crossRows = await fetchCrossAssignments(start, end)
              exportMonthlyReportCsv(balances, crossRows, `${year}-Q${quarter}`)
            }}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">סיכום לפי מחלקה — {QUARTERS[quarter - 1]} {year}</CardTitle>
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
                    <tr key={b.id} className="border-b hover:bg-muted/30">
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
                        {b.lent > 0 ? <span className="text-red-500">-{b.lent}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {b.net_balance === 0 ? (
                          <span className="text-muted-foreground flex items-center justify-end gap-1"><Minus className="h-3 w-3" />0</span>
                        ) : b.net_balance > 0 ? (
                          <span className="text-emerald-600 font-semibold flex items-center justify-end gap-1"><TrendingUp className="h-3 w-3" />+{b.net_balance}</span>
                        ) : (
                          <span className="text-red-500 font-semibold flex items-center justify-end gap-1"><TrendingDown className="h-3 w-3" />{b.net_balance}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {balances.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">אין נתונים לרבעון זה</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
