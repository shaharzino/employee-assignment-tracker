'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search, Trash2, Upload } from 'lucide-react'
import type { Employee, Department } from '@/types'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('employees').select(`*, home_dept:departments!home_dept_id(*)`).order('full_name'),
      supabase.from('departments').select('*').eq('is_active', true).order('name'),
    ])
    setEmployees((emps as unknown as Employee[]) ?? [])
    setDepartments(depts ?? [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function toggleActive(emp: Employee) {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id)

    if (error) { toast.error('שגיאה: ' + error.message); return }
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
    toast.success(emp.is_active ? 'עובד הושבת' : 'עובד הופעל')
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`האם למחוק ${selectedIds.size} עובדים? פעולה זו תמחק גם את כל השיוכים שלהם ובלתי הפיכה.`)) return
    setDeleting(true)
    const ids = [...selectedIds]
    // Delete related assignments first (FK constraint)
    const { error: assignError } = await supabase
      .from('daily_assignments')
      .delete()
      .in('employee_id', ids)
    if (assignError) {
      toast.error('שגיאה במחיקת שיוכים: ' + assignError.message)
      setDeleting(false)
      return
    }
    const { error: empError } = await supabase.from('employees').delete().in('id', ids)
    if (empError) {
      toast.error('שגיאה במחיקת עובדים: ' + empError.message)
    } else {
      const count = ids.length
      setEmployees((prev) => prev.filter((e) => !selectedIds.has(e.id)))
      setSelectedIds(new Set())
      toast.success(`נמחקו ${count} עובדים בהצלחה`)
    }
    setDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = employees.filter((e) => {
    const matchSearch = !search || e.full_name.includes(search) || (e.employee_number ?? '').includes(search)
    const matchDept = filterDept === 'all' || e.home_dept_id === filterDept
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? e.is_active : !e.is_active)
    return matchSearch && matchDept && matchStatus
  })

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); filtered.forEach((e) => n.delete(e.id)); return n })
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); filtered.forEach((e) => n.add(e.id)); return n })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">עובדים</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'מוחק...' : `מחק נבחרים (${selectedIds.size})`}
            </Button>
          )}
          <Link href="/employees/import" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-2' })}>
            <Upload className="h-4 w-4" />
            ייבא מ-Excel
          </Link>
          <Link href="/employees/new" className={buttonVariants({ size: 'sm', className: 'gap-2' })}>
            <Plus className="h-4 w-4" />
            הוסף עובד
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לפי שם או מספר עובד..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={filterDept} onValueChange={(v) => v && setFilterDept(v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="כל המחלקות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המחלקות</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">פעילים</SelectItem>
            <SelectItem value="inactive">לא פעילים</SelectItem>
            <SelectItem value="all">הכל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} עובדים
        {selectedIds.size > 0 && <span className="text-primary font-medium"> — {selectedIds.size} נבחרו</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">טוען...</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-3 text-start">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer accent-primary"
                    title="בחר הכל"
                  />
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">מספר</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">מחלקת בית</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">ימי עבודה</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr
                  key={emp.id}
                  className={`border-b transition-colors hover:bg-muted/30 ${selectedIds.has(emp.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.employee_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                  <td className="px-4 py-3">
                    {emp.home_dept ? (
                      <Badge variant="outline" style={{ borderColor: emp.home_dept.color_hex, color: emp.home_dept.color_hex }}>
                        {emp.home_dept.name}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {emp.work_days === 'sun_fri' ? 'א׳-ו׳' : 'א׳-ה׳'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={emp.is_active ? 'default' : 'secondary'}>
                      {emp.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/employees/${emp.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActive(emp)}
                        title={emp.is_active ? 'השבת' : 'הפעל'}
                      >
                        {emp.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">לא נמצאו עובדים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
