import { createClient } from '@/lib/supabase/client'
import { eachDayOfInterval, format, getDay } from 'date-fns'
import { getIsraeliHolidays } from '@/lib/hebcal'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EmployeeReportDeptRow = {
  deptId: string
  deptName: string
  colorHex: string
  days: number        // weighted days (half = 0.5)
  percentage: number  // of totalWorkingDays, rounded to nearest integer
}

export type SingleEmployeeReport = {
  employeeId: string
  employeeName: string
  employeeNumber: string | null
  totalWorkingDays: number
  deptRows: EmployeeReportDeptRow[] // sorted by days desc
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WORK_DAY_SETS: Record<string, Set<number>> = {
  sun_thu: new Set([0, 1, 2, 3, 4]),
  sun_fri: new Set([0, 1, 2, 3, 4, 5]),
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

/**
 * Fetches a department-breakdown report for a SINGLE employee over a date range.
 *
 * For each working day in [startDate, endDate]:
 *   • If the employee has an explicit assignment → credit assigned dept(s) by duration weight.
 *   • Otherwise → credit home_dept_id with 1 full day (implicit attendance).
 *
 * Returns null if the employee is not found.
 */
export async function fetchSingleEmployeeReport(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<SingleEmployeeReport | null> {
  const supabase = createClient()

  // Three parallel queries: employee, all active departments, this employee's assignments only
  const [empResult, deptsResult, assignmentsResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, employee_number, home_dept_id, work_days')
      .eq('id', employeeId)
      .single(),
    supabase
      .from('departments')
      .select('id, name, color_hex')
      .eq('is_active', true),
    supabase
      .from('daily_assignments')
      .select('work_date, dept_id, duration')
      .eq('employee_id', employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate),
  ])

  if (empResult.error || !empResult.data) return null

  const emp = empResult.data as {
    id: string
    full_name: string
    employee_number: string | null
    home_dept_id: string | null
    work_days: 'sun_thu' | 'sun_fri'
  }

  // Department lookup: id → { name, colorHex }
  const deptMap = new Map(
    (deptsResult.data ?? []).map((d) => [d.id, { name: d.name, colorHex: d.color_hex }])
  )

  // Assignment lookup: dateStr → assignment[]
  type RawAssignment = { work_date: string; dept_id: string; duration: string }
  const assignByDate = new Map<string, RawAssignment[]>()
  for (const a of (assignmentsResult.data ?? []) as RawAssignment[]) {
    if (!assignByDate.has(a.work_date)) assignByDate.set(a.work_date, [])
    assignByDate.get(a.work_date)!.push(a)
  }

  // Enumerate every calendar day in [startDate, endDate]
  const allDays = eachDayOfInterval({
    start: new Date(startDate + 'T12:00:00'),
    end: new Date(endDate + 'T12:00:00'),
  })

  // Collect Israeli holidays for every month touched by the range (parallel fetches)
  const monthKeys = [...new Set<string>(allDays.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`))]

  const holidaySets = await Promise.all(
    monthKeys.map((mk) => {
      const [y, m] = mk.split('-').map(Number)
      return getIsraeliHolidays(y, m)
    })
  )
  const allHolidays = new Set<string>(holidaySets.flatMap((s) => [...s]))

  const allowed = WORK_DAY_SETS[emp.work_days] ?? WORK_DAY_SETS.sun_thu
  const deptDays: Record<string, number> = {}
  let totalWorkingDays = 0

  for (const day of allDays) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const jsDay = getDay(day)

    if (jsDay === 6) continue                  // Shabbat
    if (allHolidays.has(dateStr)) continue     // Israeli holiday
    if (!allowed.has(jsDay)) continue          // Outside employee's work schedule

    totalWorkingDays++

    const dayAssigns = assignByDate.get(dateStr)

    if (dayAssigns && dayAssigns.length > 0) {
      // Explicit assignment(s) — credit each dept by duration weight
      for (const a of dayAssigns) {
        const weight = a.duration === 'full' ? 1.0 : 0.5
        deptDays[a.dept_id] = (deptDays[a.dept_id] ?? 0) + weight
      }
    } else {
      // No assignment → implicit full day at home department
      if (emp.home_dept_id) {
        deptDays[emp.home_dept_id] = (deptDays[emp.home_dept_id] ?? 0) + 1
      }
    }
  }

  const deptRows: EmployeeReportDeptRow[] = Object.entries(deptDays)
    .map(([deptId, days]) => {
      const dept = deptMap.get(deptId)
      return {
        deptId,
        deptName: dept?.name ?? '(מחלקה לא ידועה)',
        colorHex: dept?.colorHex ?? '#6B7280',
        days: Math.round(days * 2) / 2,
        percentage: totalWorkingDays > 0 ? Math.round((days / totalWorkingDays) * 100) : 0,
      }
    })
    .sort((a, b) => b.days - a.days)

  return {
    employeeId: emp.id,
    employeeName: emp.full_name,
    employeeNumber: emp.employee_number,
    totalWorkingDays,
    deptRows,
  }
}
