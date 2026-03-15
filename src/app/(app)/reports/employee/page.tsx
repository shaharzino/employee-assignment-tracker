'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchSingleEmployeeReport, type SingleEmployeeReport } from '@/lib/queries/employee-report'
import { exportEmployeeReportCsv } from '@/lib/export/csv'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import Link from 'next/link'
import type { Employee } from '@/types'

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

type PeriodType = 'month' | 'quarter' | 'half' | 'year'

const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  month: 'חודש',
  quarter: 'רבעון',
  half: 'חצי שנה',
  year: 'שנה',
}

const MONTH_LABELS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const QUARTER_LABELS = [
  'Q1 (ינו–מרץ)', 'Q2 (אפר–יוני)', 'Q3 (יול–ספט)', 'Q4 (אוק–דצמ)',
]

const HALF_LABELS = ['H1 (ינואר–יוני)', 'H2 (יולי–דצמבר)']

/** Returns {start, end, label} for the chosen period. sub is 1-based. */
function getPeriodRange(
  type: PeriodType,
  year: number,
  sub: number
): { start: string; end: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, '0')

  if (type === 'month') {
    const start = `${year}-${pad(sub)}-01`
    const end = new Date(year, sub, 0).toISOString().split('T')[0]
    return { start, end, label: `${MONTH_LABELS[sub - 1]} ${year}` }
  }

  if (type === 'quarter') {
    const startM = (sub - 1) * 3 + 1
    const endM = sub * 3
    return {
      start: `${year}-${pad(startM)}-01`,
      end: new Date(year, endM, 0).toISOString().split('T')[0],
      label: `${QUARTER_LABELS[sub - 1]} ${year}`,
    }
  }

  if (type === 'half') {
    const startM = sub === 1 ? 1 : 7
    const endM = sub === 1 ? 6 : 12
    return {
      start: `${year}-${pad(startM)}-01`,
      end: new Date(year, endM, 0).toISOString().split('T')[0],
      label: `${HALF_LABELS[sub - 1]} ${year}`,
    }
  }

  // year
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: `שנת ${year}`,
  }
}

function getSubOptions(type: PeriodType): { value: number; label: string }[] {
  if (type === 'month')   return MONTH_LABELS.map((l, i) => ({ value: i + 1, label: l }))
  if (type === 'quarter') return QUARTER_LABELS.map((l, i) => ({ value: i + 1, label: l }))
  if (type === 'half')    return HALF_LABELS.map((l, i) => ({ value: i + 1, label: l }))
  return []
}

function defaultSub(type: PeriodType): number {
  const now = new Date()
  const m = now.getMonth() + 1 // 1-based
  if (type === 'month')   return m
  if (type === 'quarter') return Math.ceil(m / 3)
  if (type === 'half')    return m <= 6 ? 1 : 2
  return 1
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeeReportPage() {
  const now = new Date()
  const currentYear = now.getFullYear()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState('')

  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [year, setYear] = useState(currentYear)
  const [sub, setSub] = useState(defaultSub('month'))

  const [report, setReport] = useState<SingleEmployeeReport | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // Load employee list once
  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        const emps = (data ?? []) as unknown as Employee[]
        setEmployees(emps)
        if (emps.length > 0) setSelectedEmpId(emps[0].id)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When period type changes, reset sub to sensible default
  function handlePeriodTypeChange(newType: PeriodType) {
    setPeriodType(newType)
    setSub(defaultSub(newType))
  }

  // Derived date range
  const { start, end, label } = useMemo(
    () => getPeriodRange(periodType, year, sub),
    [periodType, year, sub]
  )

  // Fetch report whenever employee or range changes
  useEffect(() => {
    if (!selectedEmpId) return
    setLoading(true)
    setReport(null)
    fetchSingleEmployeeReport(selectedEmpId, start, end)
      .then(setReport)
      .catch((err) => console.error('employee-report:', err))
      .finally(() => setLoading(false))
  }, [selectedEmpId, start, end])

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
  const subOptions = getSubOptions(periodType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">דוח עובד</h1>
          <p className="text-sm text-muted-foreground">
            {report ? `${report.employeeName} — ${label}` : 'בחר עובד ותקופה'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Navigation */}
          <nav className="flex gap-2 text-sm text-muted-foreground">
            <Link href="/reports/daily"       className="hover:text-foreground">יומי</Link>
            <span>|</span>
            <Link href="/reports/weekly"      className="hover:text-foreground">שבועי</Link>
            <span>|</span>
            <Link href="/reports/monthly"     className="hover:text-foreground">חודשי</Link>
            <span>|</span>
            <Link href="/reports/quarterly"   className="hover:text-foreground">רבעוני</Link>
            <span>|</span>
            <Link href="/reports/allocations" className="hover:text-foreground">הקצאות</Link>
            <span>|</span>
            <Link href="/reports/dept"        className="hover:text-foreground">מחלקתי</Link>
            <span>|</span>
            <span className="text-foreground font-medium">עובד</span>
          </nav>

          {/* CSV export */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading || !report || report.deptRows.length === 0}
            onClick={() => report && exportEmployeeReportCsv(report, start, end)}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Employee */}
        <select
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm min-w-48"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}{e.employee_number ? ` (${e.employee_number})` : ''}
            </option>
          ))}
        </select>

        {/* Period type */}
        <select
          value={periodType}
          onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((t) => (
            <option key={t} value={t}>{PERIOD_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Sub-period (month / quarter / half) — hidden for 'year' */}
        {subOptions.length > 0 && (
          <select
            value={sub}
            onChange={(e) => setSub(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {subOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Period strip */}
      {selectedEmpId && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {employees.find((e) => e.id === selectedEmpId)?.full_name ?? ''}
          </span>
          <span>—</span>
          <span>{start.split('-').reverse().join('/')} עד {end.split('-').reverse().join('/')}</span>
          {!loading && report && (
            <span className="text-primary font-medium">{report.totalWorkingDays} ימי עבודה</span>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">מחשב...</div>
      ) : (
        <>
          {/* Summary cards */}
          {report && report.deptRows.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-primary">{report.totalWorkingDays}</div>
                  <div className="text-muted-foreground">ימי עבודה בתקופה</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{report.deptRows.length}</div>
                  <div className="text-muted-foreground">מחלקות</div>
                </CardContent>
              </Card>
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="pt-4 text-center">
                  <div
                    className="text-2xl font-bold truncate"
                    style={{ color: report.deptRows[0]?.colorHex ?? 'inherit' }}
                  >
                    {report.deptRows[0]?.percentage ?? 0}%
                  </div>
                  <div className="text-muted-foreground truncate">
                    {report.deptRows[0]?.deptName ?? '—'}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Department breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                פילוח לפי מחלקה
                {report && ` — ${label}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקה</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">ימים</th>
                      <th className="px-4 py-3 text-end font-medium text-muted-foreground">אחוז</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.deptRows.map((row) => (
                      <tr key={row.deptId} className="border-b hover:bg-muted/30 transition-colors">
                        {/* Color chip + name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: row.colorHex }}
                            />
                            <span className="font-medium">{row.deptName}</span>
                          </div>
                        </td>
                        {/* Days */}
                        <td className="px-4 py-3 text-end tabular-nums font-medium">
                          {row.days}
                        </td>
                        {/* % + progress bar */}
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(row.percentage, 100)}%`,
                                  backgroundColor: row.colorHex,
                                }}
                              />
                            </div>
                            <span className="tabular-nums font-medium w-10 text-end">
                              {row.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {(!report || report.deptRows.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                          {!report ? 'בחר עובד ותקופה' : 'אין נתונים לתקופה זו'}
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
