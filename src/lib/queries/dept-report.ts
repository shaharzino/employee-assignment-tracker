import { createClient } from '@/lib/supabase/client'
import { countWorkingDaysInRange } from '@/lib/utils/working-days'

export type DeptReportRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string | null
  homeDeptName: string
  homeDeptColor: string
  isHome: boolean         // true = home dept employee, false = borrowed
  daysInDept: number      // days worked in the selected department
  totalWorkingDays: number
  percentage: number      // daysInDept / totalWorkingDays * 100
}

/**
 * For a given department and date range:
 * - Home employees: totalWorkingDays - days_lent_out = days in dept
 * - Borrowed employees: count of assignments to this dept = days in dept
 */
export async function fetchDeptReport(
  deptId: string,
  startDate: string,
  endDate: string
): Promise<DeptReportRow[]> {
  const supabase = createClient()

  // Fetch all active employees
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, full_name, employee_number, home_dept_id, work_days, home_dept:departments!home_dept_id(name, color_hex)')
    .eq('is_active', true)
  if (empError) throw empError

  // Fetch all assignments in range
  const { data: assignments, error: assignError } = await supabase
    .from('daily_assignments')
    .select('employee_id, dept_id, duration')
    .gte('work_date', startDate)
    .lte('work_date', endDate)
  if (assignError) throw assignError

  const allAssignments = assignments ?? []
  const allEmployees = employees as unknown as Array<{
    id: string
    full_name: string
    employee_number: string | null
    home_dept_id: string
    work_days: 'sun_thu' | 'sun_fri'
    home_dept: { name: string; color_hex: string } | null
  }>

  // Pre-compute working day count per schedule variant (at most 2: sun_thu, sun_fri)
  // Avoids calling countWorkingDaysInRange N times for N employees with the same schedule
  const uniqueSchedules = [...new Set(allEmployees.map((e) => e.work_days))]
  const workingDaysBySchedule = new Map<string, number>(
    await Promise.all(
      uniqueSchedules.map(async (wd) => [wd, await countWorkingDaysInRange(startDate, endDate, wd)] as const)
    )
  )

  const rows: DeptReportRow[] = []

  for (const emp of allEmployees) {
    const totalWorkingDays = workingDaysBySchedule.get(emp.work_days) ?? 0
    if (totalWorkingDays === 0) continue

    const empAssignments = allAssignments.filter((a) => a.employee_id === emp.id)

    if (emp.home_dept_id === deptId) {
      // Home employee: days in dept = totalWorkingDays - days lent out
      const daysLentOut = empAssignments
        .filter((a) => a.dept_id !== deptId)
        .reduce((sum, a) => sum + (a.duration === 'full' ? 1 : 0.5), 0)
      const daysInDept = totalWorkingDays - daysLentOut
      if (daysInDept <= 0) continue

      rows.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeNumber: emp.employee_number,
        homeDeptName: emp.home_dept?.name ?? '',
        homeDeptColor: emp.home_dept?.color_hex ?? '#6B7280',
        isHome: true,
        daysInDept: Math.round(daysInDept * 2) / 2,
        totalWorkingDays,
        percentage: Math.round((daysInDept / totalWorkingDays) * 100),
      })
    } else {
      // Borrowed employee: days in dept = sum of assignments to this dept
      const daysBorrowed = empAssignments
        .filter((a) => a.dept_id === deptId)
        .reduce((sum, a) => sum + (a.duration === 'full' ? 1 : 0.5), 0)
      if (daysBorrowed <= 0) continue

      rows.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeNumber: emp.employee_number,
        homeDeptName: emp.home_dept?.name ?? '',
        homeDeptColor: emp.home_dept?.color_hex ?? '#6B7280',
        isHome: false,
        daysInDept: Math.round(daysBorrowed * 2) / 2,
        totalWorkingDays,
        percentage: Math.round((daysBorrowed / totalWorkingDays) * 100),
      })
    }
  }

  return rows.sort((a, b) => b.percentage - a.percentage)
}
