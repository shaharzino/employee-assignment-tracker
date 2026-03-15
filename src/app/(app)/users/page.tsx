'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, X, UserX, UserCheck, ShieldCheck } from 'lucide-react'

type Manager = {
  id: string
  full_name: string
  email: string
  is_admin: boolean
  is_active: boolean
}

export default function UsersPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data, error } = await supabase.from('managers').select('*').order('full_name')
    if (error) { toast.error('שגיאה בטעינה: ' + error.message); return }
    setManagers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddManager() {
    if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('יש למלא את כל השדות')
      return
    }
    if (form.password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-manager`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            fullName: form.fullName.trim(),
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'שגיאה לא ידועה')

      toast.success('המנהל נוסף בהצלחה')
      setShowModal(false)
      setForm({ fullName: '', email: '', password: '' })
      load()
    } catch (err) {
      toast.error('שגיאה: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(manager: Manager) {
    const newActive = !manager.is_active
    const { error } = await supabase
      .from('managers')
      .update({ is_active: newActive })
      .eq('id', manager.id)
    if (error) { toast.error('שגיאה: ' + error.message); return }
    setManagers((prev) => prev.map((m) => m.id === manager.id ? { ...m, is_active: newActive } : m))
    toast.success(newActive ? 'המנהל הופעל' : 'המנהל הושבת')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
          <p className="text-sm text-muted-foreground">מנהלי המערכת שיכולים להתחבר</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף מנהל
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">טוען...</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">אימייל</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">הרשאות</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((mgr) => (
                <tr key={mgr.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {mgr.is_admin && <span title="מנהל ראשי"><ShieldCheck className="h-4 w-4 text-primary" /></span>}
                      {mgr.full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{mgr.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={mgr.is_admin ? 'default' : 'secondary'}>
                      {mgr.is_admin ? 'מנהל ראשי' : 'מנהל'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={mgr.is_active ? 'outline' : 'secondary'} className={mgr.is_active ? 'border-green-500 text-green-700' : ''}>
                      {mgr.is_active ? 'פעיל' : 'מושבת'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {!mgr.is_admin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(mgr)}
                        className={`gap-2 ${mgr.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}`}
                      >
                        {mgr.is_active
                          ? <><UserX className="h-4 w-4" />השבת</>
                          : <><UserCheck className="h-4 w-4" />הפעל</>
                        }
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">אין מנהלים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Manager Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border shadow-xl p-6 w-full max-w-md space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">הוסף מנהל חדש</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">שם מלא</label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">אימייל</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="manager@company.com"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">סיסמה</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="לפחות 6 תווים"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                ביטול
              </Button>
              <Button onClick={handleAddManager} disabled={saving} className="gap-2">
                <Plus className="h-4 w-4" />
                {saving ? 'שומר...' : 'הוסף מנהל'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
