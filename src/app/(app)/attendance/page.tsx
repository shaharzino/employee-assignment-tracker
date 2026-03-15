'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAttendanceStore } from '@/stores/attendance-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { format, subDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { ArrowUpDown, Copy, Save } from 'lucide-react'
import type { Employee, Department, DurationType } from '@/types'
import { DURATION_LABELS } from '@/types'

const SHIFTS: DurationType[] = ['full', 'half_morning', 'half_afternoon']
const NO_WORK = 'none'

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const supabase = createClient()
  const { date, setDate, entries, setEntry, removeEntry, loadEntries, clearDirty, getDirtyEntries } =
    useAttendanceStore()

  const loadData = useCallback(async (forDate: string) => {
    setLoading(true)
    const [{ data: emps }, { data: depts }, { data: assignments }] = await Promise.all([
      supabase.from('employees').select(`*, home_dept:departments!home_dept_id(*)`).eq('is_active', true).order('full_name'),
      supabase.from('departments').select('*').eq('is_active', true).order('name'),
      supabase.from('daily_assignments').select('*').eq('work_date', forDate),
    ])

    setEmployees((emps as unknown as Employee[]) ?? [])
    setDepartments(depts ?? [])

    loadEntries(
      (assignments ?? []).map((a) => ({
        employeeId: a.employee_id,
        workDate: forDate,
        shift: a.duration as DurationType,
        deptId: a.dept_id,
        isDirty: false,
        dbId: a.id,
      }))
    )
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(date) }, [date, loadData])

  async function handleSave() {
    const dirty = getDirtyEntries()
    if (dirty.length === 0) { toast.info('אין שינויים לשמירה'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('לא מחובר'); setSaving(false); return }

    const upserts = dirty.map((e) => ({
      ...(e.dbId ? { id: e.dbId } : {}),
      work_date: e.workDate,
      employee_id: e.employeeId,
      dept_id: e.deptId,
      duration: e.shift,
      created_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('daily_assignments').upsert(upserts, {
      onConflict: 'employee_id,work_date,duration',
    })

    if (error) { toast.error('שגיאה בשמירה: ' + error.message); setSaving(false); return }

    clearDirty()
    toast.success(`נשמרו ${dirty.length} רשומות בהצלחה`)
    setSaving(false)
  }

  async function handleCopyYesterday() {
    const yesterday = subDays(new Date(date), 1).toISOString().split('T')[0]
    const { data: yesterdayAssignments } = await supabase
      .from('daily_assignments')
      .select('*')
      .eq('work_date', yesterday)

    if (!yesterdayAssignments?.length) { toast.warning('אין נתונים מאתמול'); return }

    for (const a of yesterdayAssignments) {
      setEntry(a.employee_id, a.duration as DurationType, a.dept_id)
    }
    toast.success(`הועתקו ${yesterdayAssignments.length} רשומות מ-${format(new Date(yesterday), 'd/M/yyyy')}`)
  }

  const crossCount = Object.values(entries).flat().filter((e) => {
    const emp = employees.find((em) => em.id === e.employeeId)
    return emp && emp.home_dept_id !== e.deptId
  }).length

  const loggedCount = new Set(Object.keys(entries)).size

  const filteredEmployees = activeTab === 'all'
    ? employees
    : employees.filter((e) => e.home_dept_id === activeTab)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">נוכחות</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(date + 'T12:00:00'), 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            max={new Date().toISOString().split('T')[0]}
          />
          <Button variant="outline" size="sm" onClick={handleCopyYesterday} className="gap-2">
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">העתק מאתמול</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'שומר...' : 'שמור'}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{loggedCount} מוקלדים מתוך {employees.length}</span>
        {crossCount > 0 && (
          <span className="text-orange-600 font-medium flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" />
            {crossCount} שיוכים צולבים
          </span>
        )}
      </div>

      {/* Department tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          הכל
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveTab(d.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === d.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Attendance table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">טוען...</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">מ.עובד</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם עובד</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">משמרת</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקה להיום</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <AttendanceRow
                  key={emp.id}
                  employee={emp}
                  departments={departments}
                  entries={entries[emp.id] ?? []}
                  onSetEntry={(shift, deptId) => setEntry(emp.id, shift, deptId)}
                  onRemoveEntry={(shift) => removeEntry(emp.id, shift)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AttendanceRow({
  employee,
  departments,
  entries,
  onSetEntry,
  onRemoveEntry,
}: {
  employee: Employee
  departments: Department[]
  entries: ReturnType<typeof useAttendanceStore.getState>['entries'][string]
  onSetEntry: (shift: DurationType, deptId: string) => void
  onRemoveEntry: (shift: DurationType) => void
}) {
  // For a full-day shift, show one row. For half-days show two rows.
  const fullEntry = entries.find((e) => e.shift === 'full')
  const morningEntry = entries.find((e) => e.shift === 'half_morning')
  const afternoonEntry = entries.find((e) => e.shift === 'half_afternoon')

  const homeDeptId = employee.home_dept_id ?? ''
  const homeDept = departments.find((d) => d.id === homeDeptId)

  function isCross(deptId: string) {
    return deptId && deptId !== homeDeptId
  }

  function handleShiftSelect(shift: DurationType | typeof NO_WORK) {
    if (shift === NO_WORK) {
      // Remove all entries for this employee
      SHIFTS.forEach((s) => onRemoveEntry(s))
      return
    }
    // When switching to full: remove half entries; when switching to half: remove full
    if (shift === 'full') {
      onRemoveEntry('half_morning')
      onRemoveEntry('half_afternoon')
      onSetEntry('full', homeDeptId)
    } else {
      onRemoveEntry('full')
      onSetEntry(shift, homeDeptId)
    }
  }

  const currentShiftMode = fullEntry ? 'full' : (morningEntry || afternoonEntry) ? 'half' : NO_WORK

  const rowClass = (deptId: string) =>
    isCross(deptId) ? 'border-r-4 border-orange-400 bg-orange-50/50' : ''

  return (
    <>
      <tr className={`border-b transition-colors hover:bg-muted/30 ${fullEntry && isCross(fullEntry.deptId) ? 'border-r-4 border-orange-400 bg-orange-50/50' : ''}`}>
        <td className="px-4 py-2 text-muted-foreground text-xs">{employee.employee_number ?? '—'}</td>
        <td className="px-4 py-2 font-medium">{employee.full_name}</td>
        <td className="px-4 py-2">
          {homeDept ? (
            <Badge variant="outline" style={{ borderColor: homeDept.color_hex, color: homeDept.color_hex }}>
              {homeDept.name}
            </Badge>
          ) : '—'}
        </td>
        <td className="px-4 py-2">
          <Select
            value={currentShiftMode === 'full' ? 'full' : currentShiftMode === 'half' ? 'half' : NO_WORK}
            onValueChange={(v) => {
              if (v === 'half') {
                onRemoveEntry('full')
                onSetEntry('half_morning', homeDeptId)
                onSetEntry('half_afternoon', homeDeptId)
              } else {
                handleShiftSelect(v as DurationType | typeof NO_WORK)
              }
            }}
          >
            <SelectTrigger className="w-28 h-8">
              <SelectValue>
                {currentShiftMode === 'full' ? 'יום מלא' : currentShiftMode === 'half' ? 'חצי יום' : 'לא עבד'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_WORK}>לא עבד</SelectItem>
              <SelectItem value="full">יום מלא</SelectItem>
              <SelectItem value="half">חצי יום</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-4 py-2">
          {fullEntry ? (
            <div className="flex items-center gap-2">
              <DeptSelect
                value={fullEntry.deptId}
                departments={departments}
                onChange={(deptId) => onSetEntry('full', deptId)}
              />
              {isCross(fullEntry.deptId) && <span className="text-orange-500 text-xs">↗</span>}
            </div>
          ) : currentShiftMode === 'half' ? (
            <span className="text-xs text-muted-foreground">ראה שורות למטה</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>

      {/* Half-day rows */}
      {currentShiftMode === 'half' && (
        <>
          {(['half_morning', 'half_afternoon'] as DurationType[]).map((shift) => {
            const entry = entries.find((e) => e.shift === shift)
            const deptId = entry?.deptId ?? homeDeptId
            return (
              <tr key={shift} className={`border-b bg-muted/20 ${isCross(deptId) ? rowClass(deptId) : ''}`}>
                <td className="px-4 py-1" />
                <td className="px-4 py-1 text-xs text-muted-foreground ps-8">↳ {DURATION_LABELS[shift]}</td>
                <td className="px-4 py-1" />
                <td className="px-4 py-1" />
                <td className="px-4 py-1">
                  <div className="flex items-center gap-2">
                    <DeptSelect
                      value={deptId}
                      departments={departments}
                      onChange={(d) => onSetEntry(shift, d)}
                    />
                    {isCross(deptId) && <span className="text-orange-500 text-xs">↗</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </>
      )}
    </>
  )
}

function DeptSelect({
  value,
  departments,
  onChange,
}: {
  value: string
  departments: Department[]
  onChange: (id: string) => void
}) {
  const selectedDept = departments.find((d) => d.id === value)
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-36 h-8">
        <SelectValue>{selectedDept?.name ?? ''}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {departments.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
