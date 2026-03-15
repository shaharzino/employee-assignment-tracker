'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { AlertCircle, ArrowLeftRight, Users } from 'lucide-react'
import type { Department } from '@/types'

type DeptStat = {
  dept: Department
  total: number
  cross: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DeptStat[]>([])
  const [totalLogged, setTotalLogged] = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: depts }, { data: assignments }, { count: activeCount }] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true),
        supabase
          .from('daily_assignments')
          .select(`dept_id, duration, employees!inner(home_dept_id)`)
          .eq('work_date', today),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ])

      setTotalActive(activeCount ?? 0)

      // Count unique employees logged today
      const assignmentsData = assignments ?? []
      const uniqueEmps = new Set(
        (
          await supabase
            .from('daily_assignments')
            .select('employee_id')
            .eq('work_date', today)
        ).data?.map((r) => r.employee_id) ?? []
      )
      setTotalLogged(uniqueEmps.size)

      // Compute per-dept stats
      const deptStats: DeptStat[] = (depts ?? []).map((dept) => {
        const deptAssignments = assignmentsData.filter((a) => a.dept_id === dept.id)
        const uniqueInDept = new Set(deptAssignments.map((a) => (a as unknown as { employee_id: string }).employee_id))
        const crossCount = deptAssignments.filter((a) => {
          const emp = a.employees as unknown as { home_dept_id: string }
          return emp?.home_dept_id && emp.home_dept_id !== dept.id
        }).length
        return { dept, total: uniqueInDept.size, cross: crossCount }
      })

      setStats(deptStats)
      setLoading(false)
    }
    load()
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayFormatted = format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he })
  const hasNoData = !loading && totalLogged === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-muted-foreground text-sm">{todayFormatted}</p>
        </div>
        <Link href="/attendance" className={buttonVariants()}>הקלד נוכחות היום</Link>
      </div>

      {hasNoData && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">לא הוקלדו נתוני נוכחות להיום</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              עובדים פעילים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              מוקלדים היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '...' : totalLogged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              שיוכים צולבים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {loading ? '...' : stats.reduce((s, d) => s + d.cross, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {stats.map(({ dept, total, cross }) => (
          <Card key={dept.id} className="relative overflow-hidden">
            <div
              className="absolute top-0 start-0 h-1 w-full"
              style={{ backgroundColor: dept.color_hex }}
            />
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                {dept.name}
                {cross > 0 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                    ↗ {cross}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">עובדים היום</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
