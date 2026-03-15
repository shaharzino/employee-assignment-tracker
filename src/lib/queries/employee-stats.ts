import { createClient } from '@/lib/supabase/client'
import { eachDayOfInterval, format, getDay } from 'date-fns'
import { getIsraeliHolidays } from '@/lib/hebcal'
import type { Employee, Department, DailyAssignment } from '@/types'

export type DeptAllocation = {
  deptId: string
  deptName: string
  colorHex: string
  days: number
  percentage: number
}

export type EmployeeAllocation = {
  employeeId: string
  employeeName: string
  employeeNumber: string | null
  allocations: DeptAllocation[]
  totalWorkingDays: number
}

const WORK_DAY_SETS: Record<string, Set<number>> = {
  sun_thu: new Set([0, 1, 2, 3, 4]),
  sun_fri: new Set([0, 1, 2, 3, 4, 5]),
}

export async function fetchEmployeeAllocations(
  startDate: string,
  endDate: string
): Promise<EmployeeAllocation[]> {
  const supabase = createClient()

  const [{ data: employees }, { data: departments }, { data: assignments }] = await Promise.all([
    supabase.from('employees').select('*').eq('is_active', true).order('full_name'),
    supabase.from('departments').select('*').eq('is_active', true),
    supabase.from('daily_assignments').select('*').gte('work_date', startDate).lte('work_date', endDate),
  ])

  if (!employees || !departments) return []

  // Build department lookup
  const deptMap = new Map(departments.map(d => [d.id, d]))

  // Build assignment lookup: employeeId -> dateStr -> assignment[]
  const assignMap = new Map<string, Map<string, DailyAssignment[]>>()
  for (const a of (assignments ?? []) as unknown as DailyAssignment[]) {
    if (!assignMap.has(a.employee_id)) assignMap.set(a.employee_id, new Map())
    const empMap = assignMap.get(a.employee_id)!
    if (!empMap.has(a.work_date)) empMap.set(a.work_date, [])
    empMap.get(a.work_date)!.push(a)
  }

  // Collect all holidays for months in range
  const allDays = eachDayOfInterval({
    start: new Date(startDate + 'T12:00:00'),
    end: new Date(endDate + 'T12:00:00'),
  })
  const monthKeys = new Set<string>()
  for (const d of allDays) monthKeys.add(`${d.getFullYear()}-${d.getMonth() + 1}`)

  const allHolidays = new Set<string>()
  for (const mk of monthKeys) {
    const [y, m] = mk.split('-').map(Number)
    const h = await getIsraeliHolidays(y, m)
    for (const d of h) allHolidays.add(d)
  }

  // Calculate allocations per employee
  const results: EmployeeAllocation[] = []

  for (const emp of employees as unknown as Employee[]) {
    const allowed = WORK_DAY_SETS[emp.work_days] ?? WORK_DAY_SETS.sun_thu
    const deptDays: Record<string, number> = {}
    let totalDays = 0
    const empAssigns = assignMap.get(emp.id) ?? new Map()

    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const jsDay = getDay(day)

      // Skip non-working days
      if (jsDay === 6) continue
      if (allHolidays.has(dateStr)) continue
      if (!allowed.has(jsDay)) continue

      totalDays++
      const dayAssigns = empAssigns.get(dateStr)

      if (dayAssigns && dayAssigns.length > 0) {
        for (const a of dayAssigns) {
          const weight = a.duration === 'full' ? 1.0 : 0.5
          deptDays[a.dept_id] = (deptDays[a.dept_id] ?? 0) + weight
        }
      } else {
        // Default: home department, full day
        if (emp.home_dept_id) {
          deptDays[emp.home_dept_id] = (deptDays[emp.home_dept_id] ?? 0) + 1
        }
      }
    }

    const allocations: DeptAllocation[] = Object.entries(deptDays)
      .map(([deptId, days]) => {
        const dept = deptMap.get(deptId)
        return {
          deptId,
          deptName: dept?.name ?? '',
          colorHex: dept?.color_hex ?? '#6B7280',
          days: Math.round(days * 2) / 2,
          percentage: totalDays > 0 ? Math.round((days / totalDays) * 100) : 0,
        }
      })
      .sort((a, b) => b.days - a.days)

    results.push({
      employeeId: emp.id,
      employeeName: emp.full_name,
      employeeNumber: emp.employee_number,
      allocations,
      totalWorkingDays: totalDays,
    })
  }

  return results
}
