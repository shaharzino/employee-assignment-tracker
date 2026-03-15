'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import type { Department, Employee } from '@/types'

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [fullName, setFullName] = useState('')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [homeDeptId, setHomeDeptId] = useState('')
  const [workDays, setWorkDays] = useState<'sun_thu' | 'sun_fri'>('sun_thu')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: emp }, { data: depts }] = await Promise.all([
        supabase.from('employees').select('*').eq('id', params.id).single(),
        supabase.from('departments').select('*').eq('is_active', true).order('name'),
      ])
      if (emp) {
        setEmployee(emp as Employee)
        setFullName(emp.full_name)
        setEmployeeNumber(emp.employee_number ?? '')
        setHomeDeptId(emp.home_dept_id ?? '')
        setWorkDays(emp.work_days)
      }
      setDepartments(depts ?? [])
    }
    load()
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from('employees')
      .update({
        full_name: fullName.trim(),
        employee_number: employeeNumber.trim() || null,
        home_dept_id: homeDeptId || null,
        work_days: workDays,
      })
      .eq('id', params.id)

    if (error) {
      toast.error('שגיאה: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('עובד עודכן')
    router.push('/employees')
  }

  if (!employee) return <div className="py-12 text-center text-muted-foreground">טוען...</div>

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">עריכת עובד</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>פרטי עובד</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם מלא *</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">מספר עובד</Label>
              <Input id="number" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>מחלקת בית</Label>
              <Select value={homeDeptId} onValueChange={(v) => v && setHomeDeptId(v)}>
                <SelectTrigger><SelectValue>{departments.find(d => d.id === homeDeptId)?.name || 'בחר מחלקה'}</SelectValue></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ימי עבודה</Label>
              <Select value={workDays} onValueChange={(v) => setWorkDays(v as 'sun_thu' | 'sun_fri')}>
                <SelectTrigger><SelectValue>{workDays === 'sun_thu' ? 'ראשון–חמישי' : 'ראשון–שישי'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sun_thu">ראשון–חמישי</SelectItem>
                  <SelectItem value="sun_fri">ראשון–שישי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>ביטול</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
