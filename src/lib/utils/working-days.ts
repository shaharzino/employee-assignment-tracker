import { eachDayOfInterval, getDay, format, startOfMonth, endOfMonth } from 'date-fns'
import { getIsraeliHolidays } from '@/lib/hebcal'

export type DayStatus = 'working' | 'shabbat' | 'holiday' | 'non_working'

const WORK_DAY_SETS: Record<string, Set<number>> = {
  sun_thu: new Set([0, 1, 2, 3, 4]),     // Sun=0 .. Thu=4
  sun_fri: new Set([0, 1, 2, 3, 4, 5]),  // Sun=0 .. Fri=5
}

/**
 * Returns a Map<dateStr, DayStatus> for every day of a given month.
 * Uses the employee's work_days pattern + Israeli holidays.
 */
export async function getMonthWorkingDays(
  year: number,
  month: number, // 1-based
  workDays: 'sun_thu' | 'sun_fri'
): Promise<Map<string, DayStatus>> {
  const holidays = await getIsraeliHolidays(year, month)
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))
  const days = eachDayOfInterval({ start, end })
  const result = new Map<string, DayStatus>()
  const allowed = WORK_DAY_SETS[workDays]

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const jsDay = getDay(day)

    if (jsDay === 6) {
      result.set(dateStr, 'shabbat')
    } else if (holidays.has(dateStr)) {
      result.set(dateStr, 'holiday')
    } else if (!allowed.has(jsDay)) {
      result.set(dateStr, 'non_working')
    } else {
      result.set(dateStr, 'working')
    }
  }
  return result
}

/**
 * Check if a single date is a working day for an employee.
 */
export function isWorkingDay(
  dateStr: string,
  workDays: 'sun_thu' | 'sun_fri',
  holidays: Set<string>
): boolean {
  const day = getDay(new Date(dateStr + 'T12:00:00'))
  if (day === 6) return false
  if (holidays.has(dateStr)) return false
  return WORK_DAY_SETS[workDays].has(day)
}

/**
 * Count total working days in a date range for a given work_days pattern.
 */
export async function countWorkingDaysInRange(
  startDate: string,
  endDate: string,
  workDays: 'sun_thu' | 'sun_fri'
): Promise<number> {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const days = eachDayOfInterval({ start, end })
  const allowed = WORK_DAY_SETS[workDays]

  // Collect holidays for all months in range
  const holidayMonths = new Set<string>()
  for (const d of days) {
    holidayMonths.add(`${d.getFullYear()}-${d.getMonth() + 1}`)
  }

  const allHolidays = new Set<string>()
  for (const mk of holidayMonths) {
    const [y, m] = mk.split('-').map(Number)
    const h = await getIsraeliHolidays(y, m)
    for (const d of h) allHolidays.add(d)
  }

  let count = 0
  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const jsDay = getDay(day)
    if (jsDay === 6) continue
    if (allHolidays.has(dateStr)) continue
    if (!allowed.has(jsDay)) continue
    count++
  }
  return count
}
