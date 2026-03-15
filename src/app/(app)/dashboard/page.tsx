'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { ArrowLeftRight, Users, CalendarDays } from 'lucide-react'
import type { Department } from '@/types'

type DeptStat = {
  dept: Department
  homeCount: number
  borrowedCount: number
  lentCount: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DeptStat[]>([])
  const [totalActive, setTotalActive] = useState(0)
  const [totalCross, setTotalCross] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: depts }, { data: emps }, { data: assignments }] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true),
        supabase.from('employees').select('id, home_dept_id').eq('is_active', true),
        supabase
          .from('daily_assignments')
          .select(`employee_id, dept_id, duration, employees!inner(home_dept_id)`)
          .eq('work_date', today),
      ])

      const allEmployees = emps ?? []
      const allDepts = depts ?? []
      const assignmentsData = assignments ?? []

      setTotalActive(allEmployees.length)

      // Count cross-assignments (exceptions where dept ≠ home dept)
      const crossAssignments = assignmentsData.filter((a) => {
        const emp = a.employees as unknown as { home_dept_id: string }
        return emp?.home_dept_id && emp.home_dept_id !== a.dept_id
      })
      setTotalCross(crossAssignments.length)

      // Build per-department stats
      // In "changes only" mode:
      // - homeCount = employees whose home_dept = this dept
      // - borrowedCount = cross-assignments INTO this dept (exception records where dept_id = this dept, home_dept ≠ this dept)
      // - lentCount = cross-assignments FROM this dept (exception records where home_dept = this dept, dept_id ≠ this dept)
      const deptStats: DeptStat[] = allDepts.map((dept) => {
        const homeCount = allEmployees.filter((e) => e.home_dept_id === dept.id).length

        const borrowedCount = assignmentsData.filter((a) => {
          const emp = a.employees as unknown as { home_dept_id: string }
          return a.dept_id === dept.id && emp?.home_dept_id !== dept.id
        }).length

        const lentCount = assignmentsData.filter((a) => {
          const emp = a.employees as unknown as { home_dept_id: string }
          return emp?.home_dept_id === dept.id && a.dept_id !== dept.id
        }).length

        return { dept, homeCount, borrowedCount, lentCount }
      })

      setStats(deptStats)
      setLoading(false)
    }
    load()
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayFormatted = format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-muted-foreground text-sm">{todayFormatted}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar" className={buttonVariants({ variant: 'outline' })}>
            <CalendarDays className="h-4 w-4 me-2" />
            לוח שנה
          </Link>
          <Link href="/attendance" className={buttonVariants()}>הקלד נוכחות היום</Link>
        </div>
      </div>

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
            <p className="text-3xl font-bold">{loading ? '...' : totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              שיוכים צולבים היום
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {loading ? '...' : totalCross}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              מחלקות פעילות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '...' : stats.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {stats.map(({ dept, homeCount, borrowedCount, lentCount }) => {
          const effectiveCount = homeCount + borrowedCount - lentCount
          return (
            <Card key={dept.id} className="relative overflow-hidden">
              <div
                className="absolute top-0 start-0 h-1 w-full"
                style={{ backgroundColor: dept.color_hex }}
              />
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  {dept.name}
                  {(borrowedCount > 0 || lentCount > 0) && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                      ↗ {borrowedCount > 0 ? `+${borrowedCount}` : ''}{borrowedCount > 0 && lentCount > 0 ? ' / ' : ''}{lentCount > 0 ? `-${lentCount}` : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{effectiveCount}</p>
                <p className="text-xs text-muted-foreground">
                  עובדים היום
                  {homeCount !== effectiveCount && (
                    <span className="text-muted-foreground/60"> ({homeCount} בית)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
