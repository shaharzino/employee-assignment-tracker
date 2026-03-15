'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { he } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmployeeDeptPie } from '@/components/employee-dept-pie'
import { fetchEmployeeAllocations, type EmployeeAllocation } from '@/lib/queries/employee-stats'
import Link from 'next/link'

type Period = 'week' | 'month' | 'quarter' | 'year'

function getPeriodRange(period: Period, refDate: Date): { start: string; end: string; label: string } {
  switch (period) {
    case 'week': {
      const s = startOfWeek(refDate, { weekStartsOn: 0 })
      const e = endOfWeek(refDate, { weekStartsOn: 0 })
      return {
        start: format(s, 'yyyy-MM-dd'),
        end: format(e, 'yyyy-MM-dd'),
        label: `${format(s, 'd/M', { locale: he })} - ${format(e, 'd/M/yyyy', { locale: he })}`,
      }
    }
    case 'month': {
      const s = startOfMonth(refDate)
      const e = endOfMonth(refDate)
      return {
        start: format(s, 'yyyy-MM-dd'),
        end: format(e, 'yyyy-MM-dd'),
        label: format(s, 'MMMM yyyy', { locale: he }),
      }
    }
    case 'quarter': {
      const q = Math.floor(refDate.getMonth() / 3)
      const s = new Date(refDate.getFullYear(), q * 3, 1)
      const e = endOfMonth(new Date(refDate.getFullYear(), q * 3 + 2, 1))
      return {
        start: format(s, 'yyyy-MM-dd'),
        end: format(e, 'yyyy-MM-dd'),
        label: `Q${q + 1} ${refDate.getFullYear()}`,
      }
    }
    case 'year': {
      const s = startOfYear(refDate)
      const e = endOfYear(refDate)
      return {
        start: format(s, 'yyyy-MM-dd'),
        end: format(e, 'yyyy-MM-dd'),
        label: String(refDate.getFullYear()),
      }
    }
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'שבועי',
  month: 'חודשי',
  quarter: 'רבעוני',
  year: 'שנתי',
}

export default function AllocationsReportPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<EmployeeAllocation[]>([])
  const [loading, setLoading] = useState(true)

  const { start, end, label } = useMemo(() => getPeriodRange(period, new Date()), [period])

  useEffect(() => {
    setLoading(true)
    fetchEmployeeAllocations(start, end)
      .then(setData)
      .finally(() => setLoading(false))
  }, [start, end])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">הקצאת עובדים</h1>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily" className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <Link href="/reports/weekly" className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <Link href="/reports/monthly" className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <Link href="/reports/quarterly" className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <span className="text-foreground font-medium">הקצאות</span>
            <span>|</span>
            <Link href="/reports/dept" className="hover:text-foreground">מחלקתי</Link>
            <span>|</span>
            <Link href="/reports/employee" className="hover:text-foreground">עובד</Link>
          </nav>
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <Button
                key={p}
                variant={p === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען נתונים...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map(emp => (
            <Card key={emp.employeeId}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <EmployeeDeptPie allocations={emp.allocations} size={100} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{emp.employeeName}</p>
                    {emp.employeeNumber && (
                      <p className="text-xs text-muted-foreground mb-2">מ.ע {emp.employeeNumber}</p>
                    )}
                    <div className="space-y-1">
                      {emp.allocations.map(a => (
                        <div key={a.deptId} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.colorHex }} />
                          <span className="truncate">{a.deptName}</span>
                          <span className="ms-auto text-muted-foreground tabular-nums">
                            {a.days} ({a.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      סה&quot;כ {emp.totalWorkingDays} ימי עבודה
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
