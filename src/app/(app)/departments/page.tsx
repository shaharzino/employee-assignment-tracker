'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Pencil, Power } from 'lucide-react'
import type { Department } from '@/types'

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
  '#6B7280', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
]

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [empCounts, setEmpCounts] = useState<Record<string, number>>({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const [{ data: depts }, { data: counts }] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('employees').select('home_dept_id').eq('is_active', true),
    ])
    setDepartments(depts ?? [])
    const c: Record<string, number> = {}
    for (const e of counts ?? []) {
      if (e.home_dept_id) c[e.home_dept_id] = (c[e.home_dept_id] ?? 0) + 1
    }
    setEmpCounts(c)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditing(null); setName(''); setColor(PRESET_COLORS[0]); setOpen(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept); setName(dept.name); setColor(dept.color_hex); setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('שם חובה'); return }
    setSaving(true)

    if (editing) {
      const { error } = await supabase.from('departments').update({ name: name.trim(), color_hex: color }).eq('id', editing.id)
      if (error) { toast.error('שגיאה: ' + error.message); setSaving(false); return }
      toast.success('מחלקה עודכנה')
    } else {
      const { error } = await supabase.from('departments').insert({ name: name.trim(), color_hex: color })
      if (error) { toast.error(error.message.includes('unique') ? 'מחלקה בשם זה כבר קיימת' : 'שגיאה: ' + error.message); setSaving(false); return }
      toast.success('מחלקה נוספה')
    }

    setOpen(false); setSaving(false); load()
  }

  async function toggleActive(dept: Department) {
    if (dept.is_active && (empCounts[dept.id] ?? 0) > 0) {
      toast.error(`לא ניתן להשבית מחלקה עם ${empCounts[dept.id]} עובדים פעילים`)
      return
    }
    const { error } = await supabase.from('departments').update({ is_active: !dept.is_active }).eq('id', dept.id)
    if (error) { toast.error('שגיאה'); return }
    toast.success(dept.is_active ? 'מחלקה הושבתה' : 'מחלקה הופעלה')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מחלקות</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף מחלקה
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <Card key={dept.id} className={`relative overflow-hidden ${!dept.is_active ? 'opacity-60' : ''}`}>
            <div className="absolute top-0 start-0 h-1.5 w-full" style={{ backgroundColor: dept.color_hex }} />
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-base">{dept.name}</p>
                <p className="text-sm text-muted-foreground">
                  {empCounts[dept.id] ?? 0} עובדים פעילים
                </p>
                {!dept.is_active && (
                  <Badge variant="secondary" className="mt-1 text-xs">לא פעיל</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => toggleActive(dept)}>
                  <Power className={`h-4 w-4 ${dept.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת מחלקה' : 'הוסף מחלקה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>שם מחלקה *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המחלקה" />
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer border"
                  title="צבע מותאם"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
