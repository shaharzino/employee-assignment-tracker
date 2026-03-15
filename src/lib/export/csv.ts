import Papa from 'papaparse'
import { DeptBalance, CrossAssignmentRow } from '@/lib/queries/reports'
import type { DeptReportRow } from '@/lib/queries/dept-report'
import type { SingleEmployeeReport } from '@/lib/queries/employee-report'
import { DURATION_LABELS } from '@/types'
import type { DurationType } from '@/types'

const BOM = '\uFEFF'

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportMonthlyReportCsv(
  balances: DeptBalance[],
  crossRows: CrossAssignmentRow[],
  month: string // "2026-03"
) {
  const [year, mon] = month.split('-')
  const monthName = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  // Section 1: balance table
  const balanceRows = balances.map((b) => ({
    'מחלקה': b.name,
    'שאלה (ימי עובד)': b.borrowed,
    'השאילה (ימי עובד)': b.lent,
    'יתרה': b.net_balance,
  }))

  const section1 = Papa.unparse(balanceRows)

  // Section 2: cross-assignment detail
  const detailRows = crossRows.map((r) => ({
    'שם עובד': r.employee_name,
    'מספר עובד': r.employee_number ?? '',
    'מחלקת בית': r.home_dept_name,
    'עבד ב': r.worked_dept_name,
    'תאריך': r.work_date.split('-').reverse().join('/'),
    'משמרת': DURATION_LABELS[r.duration as DurationType] ?? r.duration,
  }))

  const section2 = Papa.unparse(detailRows)

  const content = `דוח חודשי - ${monthName}\n\nסיכום לפי מחלקה\n${section1}\n\nפירוט שיוכים צולבים\n${section2}`
  downloadCsv(content, `דוח_חודשי_${month}.csv`)
}

export function exportDailyReportCsv(
  crossRows: CrossAssignmentRow[],
  date: string
) {
  const formattedDate = date.split('-').reverse().join('/')
  const rows = crossRows.map((r) => ({
    'שם עובד': r.employee_name,
    'מספר עובד': r.employee_number ?? '',
    'מחלקת בית': r.home_dept_name,
    'עבד ב': r.worked_dept_name,
    'משמרת': DURATION_LABELS[r.duration as DurationType] ?? r.duration,
  }))
  const content = Papa.unparse(rows)
  downloadCsv(content, `דוח_יומי_${date}.csv`)
}

export function exportDeptReportCsv(
  rows: DeptReportRow[],
  deptName: string,
  start: string,
  end: string
) {
  const lines = [
    `דוח מחלקתי - ${deptName}`,
    `תקופה: ${start.split('-').reverse().join('/')} עד ${end.split('-').reverse().join('/')}`,
    '',
    Papa.unparse(rows.map((r) => ({
      'שם עובד': r.employeeName,
      'מ.עובד': r.employeeNumber ?? '',
      'מחלקת בית': r.homeDeptName,
      'סוג': r.isHome ? 'בית' : 'שאול',
      'ימים במחלקה': r.daysInDept,
      'ימי עבודה כלליים': r.totalWorkingDays,
      'אחוז': `${r.percentage}%`,
    }))),
  ]
  downloadCsv(lines.join('\n'), `דוח_מחלקתי_${deptName}_${start.slice(0, 7)}.csv`)
}

export function exportEmployeeReportCsv(
  report: SingleEmployeeReport,
  start: string,
  end: string
) {
  const lines = [
    `דוח עובד — ${report.employeeName}`,
    report.employeeNumber ? `מספר עובד: ${report.employeeNumber}` : '',
    `תקופה: ${start.split('-').reverse().join('/')} עד ${end.split('-').reverse().join('/')}`,
    `ימי עבודה בתקופה: ${report.totalWorkingDays}`,
    '',
    Papa.unparse(
      report.deptRows.map((r) => ({
        'מחלקה': r.deptName,
        'ימים': r.days,
        'אחוז': `${r.percentage}%`,
      }))
    ),
  ].join('\n')

  const safeName = report.employeeName.replace(/\s+/g, '_')
  downloadCsv(lines, `דוח_עובד_${safeName}_${start.slice(0, 7)}.csv`)
}
