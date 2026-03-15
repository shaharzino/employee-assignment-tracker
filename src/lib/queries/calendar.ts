import { createClient } from '@/lib/supabase/client'
import type { Employee, Department, DailyAssignment } from '@/types'

export type CalendarMonthData = {
  employees: (Employee & { home_dept: Department | null })[]
  departments: Department[]
  assignments: DailyAssignment[]
}

export async function fetchCalendarMonth(
  year: number,
  month: number
): Promise<CalendarMonthData> {
  const supabase = createClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [{ data: employees }, { data: departments }, { data: assignments }] = await Promise.all([
    supabase
      .from('employees')
      .select('*, home_dept:departments!home_dept_id(*)')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('daily_assignments')
      .select('*')
      .gte('work_date', startDate)
      .lte('work_date', endDate),
  ])

  return {
    employees: (employees ?? []) as unknown as CalendarMonthData['employees'],
    departments: departments ?? [],
    assignments: (assignments ?? []) as unknown as DailyAssignment[],
  }
}

export async function upsertAssignment(params: {
  workDate: string
  employeeId: string
  deptId: string
  duration: 'full' | 'half_morning' | 'half_afternoon'
  userId: string
  existingId?: string
}): Promise<string> {
  const supabase = createClient()
  const record: Record<string, unknown> = {
    work_date: params.workDate,
    employee_id: params.employeeId,
    dept_id: params.deptId,
    duration: params.duration,
    updated_by: params.userId,
    updated_at: new Date().toISOString(),
  }

  if (params.existingId) {
    record.id = params.existingId
  } else {
    record.created_by = params.userId
  }

  const { data, error } = await supabase
    .from('daily_assignments')
    .upsert(record, { onConflict: 'employee_id,work_date,duration' })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function deleteAssignment(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('daily_assignments')
    .delete()
    .eq('id', id)

  if (error) throw error
}
