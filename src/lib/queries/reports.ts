import { createClient } from '@/lib/supabase/client'

export type DeptBalance = {
  id: string
  name: string
  color_hex: string
  borrowed: number
  lent: number
  net_balance: number
}

export type CrossAssignmentRow = {
  employee_name: string
  employee_number: string | null
  home_dept_name: string
  worked_dept_name: string
  worked_dept_color: string
  work_date: string
  duration: string
}

export type EmployeeMonthSummary = {
  employee_name: string
  employee_number: string | null
  dept_name: string
  dept_color: string
  days_worked: number
}

export async function fetchDeptBalances(startDate: string, endDate: string): Promise<DeptBalance[]> {
  const supabase = createClient()

  // Fetch all cross-assignments in range
  const { data, error } = await supabase
    .from('daily_assignments')
    .select(`
      dept_id,
      duration,
      employees!inner (
        home_dept_id
      )
    `)
    .gte('work_date', startDate)
    .lte('work_date', endDate)

  if (error) throw error

  // Fetch departments
  const { data: depts } = await supabase
    .from('departments')
    .select('id, name, color_hex')
    .eq('is_active', true)

  if (!depts) return []

  // Aggregate cross-assignments
  const borrowed: Record<string, number> = {}
  const lent: Record<string, number> = {}

  for (const row of data ?? []) {
    const emp = row.employees as unknown as { home_dept_id: string }
    if (!emp?.home_dept_id || row.dept_id === emp.home_dept_id) continue
    const val = row.duration === 'full' ? 1.0 : 0.5
    borrowed[row.dept_id] = (borrowed[row.dept_id] ?? 0) + val
    lent[emp.home_dept_id] = (lent[emp.home_dept_id] ?? 0) + val
  }

  return depts.map((d) => ({
    id: d.id,
    name: d.name,
    color_hex: d.color_hex,
    borrowed: Math.round((borrowed[d.id] ?? 0) * 2) / 2,
    lent: Math.round((lent[d.id] ?? 0) * 2) / 2,
    net_balance: Math.round(((borrowed[d.id] ?? 0) - (lent[d.id] ?? 0)) * 2) / 2,
  })).sort((a, b) => Math.abs(b.net_balance) - Math.abs(a.net_balance))
}

export async function fetchCrossAssignments(startDate: string, endDate: string): Promise<CrossAssignmentRow[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('daily_assignments')
    .select(`
      work_date,
      duration,
      dept_id,
      employees!inner (
        full_name,
        employee_number,
        home_dept_id
      ),
      departments!inner (
        name,
        color_hex
      )
    `)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: false })

  if (error) throw error

  const { data: depts } = await supabase
    .from('departments')
    .select('id, name')

  const deptMap: Record<string, string> = {}
  for (const d of depts ?? []) deptMap[d.id] = d.name

  const rows: CrossAssignmentRow[] = []
  for (const row of data ?? []) {
    const emp = row.employees as unknown as { full_name: string; employee_number: string | null; home_dept_id: string }
    const dept = row.departments as unknown as { name: string; color_hex: string }
    if (!emp?.home_dept_id || row.dept_id === emp.home_dept_id) continue

    rows.push({
      employee_name: emp.full_name,
      employee_number: emp.employee_number,
      home_dept_name: deptMap[emp.home_dept_id] ?? '',
      worked_dept_name: dept.name,
      worked_dept_color: dept.color_hex,
      work_date: row.work_date,
      duration: row.duration,
    })
  }

  return rows
}
