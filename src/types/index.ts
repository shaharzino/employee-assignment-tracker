export type Department = {
  id: string
  name: string
  color_hex: string
  is_active: boolean
  created_at: string
}

export type Employee = {
  id: string
  full_name: string
  employee_number: string | null
  home_dept_id: string | null
  work_days: 'sun_thu' | 'sun_fri'
  is_active: boolean
  created_at: string
  home_dept?: Department
}

export type DurationType = 'full' | 'half_morning' | 'half_afternoon'

export type DailyAssignment = {
  id: string
  work_date: string
  employee_id: string
  dept_id: string
  duration: DurationType
  notes: string | null
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
  employee?: Employee
  department?: Department
}

export type Manager = {
  id: string
  full_name: string
  email: string
  is_admin: boolean
  is_active: boolean
}

/** Shared colour palette used when auto-assigning colours to new departments */
export const DEPT_COLOR_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4',
  '#84CC16', '#A855F7', '#E11D48', '#0EA5E9', '#D97706',
]

export type DurationValue = 1.0 | 0.5

export const DURATION_VALUES: Record<DurationType, DurationValue> = {
  full: 1.0,
  half_morning: 0.5,
  half_afternoon: 0.5,
}

export const DURATION_LABELS: Record<DurationType, string> = {
  full: 'יום מלא',
  half_morning: 'בוקר',
  half_afternoon: 'אחה"צ',
}
