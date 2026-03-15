'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('שגיאת כניסה: ' + (error.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : error.message))
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      toast.error('שגיאת הרשמה: ' + error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Insert into managers table as admin
      const { error: mgErr } = await supabase.from('managers').insert({
        id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        is_admin: true,
      })

      if (mgErr) {
        toast.error('נרשמת אבל שגיאה ביצירת מנהל: ' + mgErr.message)
        setLoading(false)
        return
      }

      toast.success('נרשמת בהצלחה!')
      router.push('/dashboard')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">מערכת שיוך עובדים</CardTitle>
          <CardDescription>{mode === 'login' ? 'כניסה למנהלים בלבד' : 'יצירת חשבון מנהל'}</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="manager@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'מתחבר...' : 'כניסה'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                אין לך חשבון?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-primary underline">
                  הרשמה
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">שם מלא</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="ישראל ישראלי"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">אימייל</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="manager@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">סיסמה (לפחות 6 תווים)</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'נרשם...' : 'הרשמה'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                יש לך כבר חשבון?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-primary underline">
                  כניסה
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
