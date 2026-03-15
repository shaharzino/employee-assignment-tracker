'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import type { Department } from '@/types'

export default function NewEmployeePage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [fullName, setFullName] = useState('')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [homeDeptId, setHomeDeptId] = useState('')
  const [workDays, setWorkDays] = useState<'sun_thu' | 'sun_fri'>('sun_thu')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('departments').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setDepartments(data ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('שם חובה'); return }
    setSaving(true)

    const { error } = await supabase.from('employees').insert({
      full_name: fullName.trim(),
      employee_number: employeeNumber.trim() || null,
      home_dept_id: homeDeptId || null,
      work_days: workDays,
    })

    if (error) {
      toast.error(error.message.includes('unique') ? 'מספר עובד כבר קיים' : 'שגיאה: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('עובד נוסף בהצלחה')
    router.push('/employees')
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">הוסף עובד</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>פרטי עובד</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם מלא *</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">מספר עובד</Label>
              <Input
                id="number"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="1042"
              />
            </div>
            <div className="space-y-2">
              <Label>מחלקת בית</Label>
              <Select value={homeDeptId} onValueChange={(v) => v && setHomeDeptId(v)}>
                <SelectTrigger>
                  <SelectValue>{departments.find(d => d.id === homeDeptId)?.name || 'בחר מחלקה'}</SelectValue>
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue>{workDays === 'sun_thu' ? 'ראשון–חמישי' : 'ראשון–שישי'}</SelectValue>
                </SelectTrigger>
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
