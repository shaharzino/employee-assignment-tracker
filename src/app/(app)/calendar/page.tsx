'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { fetchCalendarMonth, upsertAssignment, deleteAssignment } from '@/lib/queries/calendar'
import { getMonthWorkingDays, type DayStatus } from '@/lib/utils/working-days'
import { EmployeeDeptPie } from '@/components/employee-dept-pie'
import { createClient } from '@/lib/supabase/client'
import type { Employee, Department, DailyAssignment } from '@/types'

const HEB_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

type EmployeeWithDept = Employee & { home_dept: Department | null }

export default function CalendarPage() {
  const [monthDate, setMonthDate] = useState(() => new Date())
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth() + 1

  const [employees, setEmployees] = useState<EmployeeWithDept[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [assignments, setAssignments] = useState<DailyAssignment[]>([])
  const [dayStatuses, setDayStatuses] = useState<Map<string, DayStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const [filterDept, setFilterDept] = useState('all')

  // Get auth user
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // Load data when month changes
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [data, statuses] = await Promise.all([
        fetchCalendarMonth(year, month),
        getMonthWorkingDays(year, month, 'sun_thu'), // base statuses; refined per employee
      ])
      setEmployees(data.employees)
      setDepartments(data.departments)
      setAssignments(data.assignments)
      setDayStatuses(statuses)
    } catch (err) {
      toast.error('שגיאה בטעינת נתונים')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  // Build assignment lookup: `${employeeId}-${dateStr}` → DailyAssignment[]
  const assignMap = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>()
    for (const a of assignments) {
      const key = `${a.employee_id}-${a.work_date}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(a)
    }
    return m
  }, [assignments])

  // Build dept lookup
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

  // Days of month
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Month navigation
  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: he })

  // Handle cell click → assign to dept
  async function handleAssign(emp: EmployeeWithDept, dateStr: string, deptId: string) {
    const existing = assignMap.get(`${emp.id}-${dateStr}`)?.find(a => a.duration === 'full')

    if (deptId === emp.home_dept_id) {
      // Selecting home dept → delete exception (return to default)
      if (existing) {
        // Optimistic delete
        setAssignments(prev => prev.filter(a => a.id !== existing.id))
        try {
          await deleteAssignment(existing.id)
        } catch {
          loadData()
          toast.error('שגיאה במחיקה')
        }
      }
      return
    }

    // Optimistic upsert
    const tempId = existing?.id ?? crypto.randomUUID()
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.employee_id === emp.id && a.work_date === dateStr && a.duration === 'full'))
      return [...filtered, {
        id: tempId,
        employee_id: emp.id,
        work_date: dateStr,
        dept_id: deptId,
        duration: 'full' as const,
        notes: null,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }]
    })

    try {
      await upsertAssignment({
        workDate: dateStr,
        employeeId: emp.id,
        deptId,
        duration: 'full',
        userId,
        existingId: existing?.id,
      })
    } catch {
      loadData()
      toast.error('שגיאה בשמירה')
    }
  }

  // Calculate pie allocations per employee (for current month)
  function getEmployeePieData(emp: EmployeeWithDept) {
    const allowed = emp.work_days === 'sun_fri'
      ? new Set([0, 1, 2, 3, 4, 5])
      : new Set([0, 1, 2, 3, 4])

    const deptDays: Record<string, number> = {}
    let total = 0

    for (const dayNum of daysArray) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      const jsDay = getDay(new Date(dateStr + 'T12:00:00'))
      const status = dayStatuses.get(dateStr)

      if (jsDay === 6 || status === 'holiday' || !allowed.has(jsDay)) continue
      total++

      const dayAssigns = assignMap.get(`${emp.id}-${dateStr}`)
      if (dayAssigns && dayAssigns.length > 0) {
        for (const a of dayAssigns) {
          const w = a.duration === 'full' ? 1 : 0.5
          deptDays[a.dept_id] = (deptDays[a.dept_id] ?? 0) + w
        }
      } else if (emp.home_dept_id) {
        deptDays[emp.home_dept_id] = (deptDays[emp.home_dept_id] ?? 0) + 1
      }
    }

    return Object.entries(deptDays)
      .map(([id, days]) => {
        const d = deptMap.get(id)
        return {
          deptId: id,
          deptName: d?.name ?? '',
          colorHex: d?.color_hex ?? '#6B7280',
          days: Math.round(days * 2) / 2,
          percentage: total > 0 ? Math.round((days / total) * 100) : 0,
        }
      })
      .sort((a, b) => b.days - a.days)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">לוח שנה</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-36 text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex gap-3 flex-wrap text-xs">
        {departments.map(d => (
          <div key={d.id} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color_hex }} />
            <span>{d.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span>לא עובד</span>
        </div>
      </div>

      {/* Department filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
        <button
          onClick={() => setFilterDept('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
            filterDept === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          הכל
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setFilterDept(d.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              filterDept === d.id ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
            style={filterDept === d.id ? { backgroundColor: d.color_hex } : {}}
          >
            {d.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">טוען לוח שנה...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div
            className="grid min-w-[900px]"
            style={{
              gridTemplateColumns: `160px repeat(${daysInMonth}, minmax(28px, 1fr)) 110px`,
            }}
          >
            {/* Header row: empty + day numbers + pie label */}
            <div className="sticky start-0 z-20 bg-muted/50 border-b border-e px-2 py-2 text-xs font-medium text-muted-foreground flex items-center">
              עובד
            </div>
            {daysArray.map(day => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const jsDay = getDay(new Date(dateStr + 'T12:00:00'))
              const isShabbat = jsDay === 6
              const isFriday = jsDay === 5
              const isHoliday = dayStatuses.get(dateStr) === 'holiday'
              return (
                <div
                  key={day}
                  className={`border-b border-e text-center py-1 text-[10px] ${
                    isShabbat ? 'bg-muted/70 text-muted-foreground' :
                    isHoliday ? 'bg-amber-50 text-amber-600' :
                    isFriday ? 'bg-muted/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{day}</div>
                  <div className={isShabbat ? 'text-red-400' : ''}>{HEB_DAYS[jsDay]}</div>
                </div>
              )
            })}
            <div className="bg-muted/50 border-b px-2 py-2 text-xs font-medium text-muted-foreground flex items-center justify-center">
              חלוקה
            </div>

            {/* Employee rows */}
            {employees.filter(emp => filterDept === 'all' || emp.home_dept_id === filterDept).map(emp => {
              const pieData = getEmployeePieData(emp)
              const empAllowed = emp.work_days === 'sun_fri'
                ? new Set([0, 1, 2, 3, 4, 5])
                : new Set([0, 1, 2, 3, 4])

              return (
                <div key={emp.id} className="contents">
                  {/* Sticky name column */}
                  <div className="sticky start-0 z-10 bg-background border-b border-e px-2 flex items-center gap-2 min-h-[36px]">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: emp.home_dept?.color_hex ?? '#ccc' }}
                    />
                    <span className="text-sm truncate">{emp.full_name}</span>
                  </div>

                  {/* Day cells */}
                  {daysArray.map(day => {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const jsDay = getDay(new Date(dateStr + 'T12:00:00'))
                    const isShabbat = jsDay === 6
                    const isHoliday = dayStatuses.get(dateStr) === 'holiday'
                    const isNonWorking = isShabbat || isHoliday || !empAllowed.has(jsDay)

                    if (isNonWorking) {
                      return (
                        <div
                          key={day}
                          className="border-b border-e bg-muted/30 flex items-center justify-center"
                          title={isShabbat ? 'שבת' : isHoliday ? 'חג' : 'לא עובד'}
                        />
                      )
                    }

                    const dayAssigns = assignMap.get(`${emp.id}-${dateStr}`)
                    const fullAssign = dayAssigns?.find(a => a.duration === 'full')
                    const deptId = fullAssign ? fullAssign.dept_id : emp.home_dept_id
                    const dept = deptMap.get(deptId ?? '')
                    const isException = fullAssign && fullAssign.dept_id !== emp.home_dept_id
                    const colorHex = dept?.color_hex ?? '#d1d5db'

                    return (
                      <Popover key={day}>
                        <PopoverTrigger
                          className={`border-b border-e flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all relative ${
                            isException ? 'ring-1 ring-orange-400' : ''
                          }`}
                          title={`${dept?.name ?? ''} ${isException ? '(שיוך צולב)' : ''}`}
                        >
                          <div
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: colorHex }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-2" side="bottom" align="center">
                          <p className="text-xs text-muted-foreground font-medium mb-2 truncate">
                            {emp.full_name} — {day}/{month}
                          </p>
                          <div className="space-y-0.5">
                            {departments.map(d => (
                              <button
                                key={d.id}
                                onClick={() => handleAssign(emp, dateStr, d.id)}
                                className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                                  d.id === deptId ? 'bg-muted font-medium' : ''
                                }`}
                              >
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color_hex }} />
                                <span className="truncate">{d.name}</span>
                                {d.id === emp.home_dept_id && (
                                  <span className="text-[10px] text-muted-foreground ms-auto">(בית)</span>
                                )}
                                {d.id === deptId && <Check className="h-3 w-3 ms-auto shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )
                  })}

                  {/* Pie chart column */}
                  <div className="border-b flex items-center justify-center">
                    {pieData.length > 1 ? (
                      <EmployeeDeptPie allocations={pieData} size={32} />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: pieData[0]?.colorHex ?? '#ccc' }}
                        title={`${pieData[0]?.deptName}: 100%`}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
