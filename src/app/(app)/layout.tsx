'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building2,
  BarChart3,
  CalendarDays,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/calendar', label: 'לוח שנה', icon: CalendarDays },
  { href: '/attendance', label: 'נוכחות', icon: ClipboardList },
  { href: '/employees', label: 'עובדים', icon: Users },
  { href: '/departments', label: 'מחלקות', icon: Building2 },
  { href: '/reports/monthly', label: 'דוחות', icon: BarChart3 },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('יצאת מהמערכת')
    router.push('/login')
  }

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center px-4 gap-4">
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="תפריט"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-semibold text-lg">שיוך עובדים</span>
          <nav className="hidden md:flex items-center gap-1 flex-1">
            <NavLinks />
          </nav>
          <div className="mr-auto">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">יציאה</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-b bg-background px-4 py-3 flex flex-col gap-1">
          <NavLinks />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
