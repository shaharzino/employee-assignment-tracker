import type { DeptBalance, CrossAssignmentRow } from '@/lib/queries/reports'
import { DURATION_LABELS } from '@/types'
import type { DurationType } from '@/types'

export function exportMonthlyReportPdf(
  balances: DeptBalance[],
  crossRows: CrossAssignmentRow[],
  month: string // "2026-03"
) {
  const [year, mon] = month.split('-')
  const monthName = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  })

  const balanceRows = balances.map((b) => `
      <tr>
        <td>${b.name}</td>
        <td class="num">${b.borrowed > 0 ? b.borrowed : '—'}</td>
        <td class="num">${b.lent > 0 ? b.lent : '—'}</td>
        <td class="num ${b.net_balance > 0 ? 'positive' : b.net_balance < 0 ? 'negative' : 'neutral'}">
          ${b.net_balance > 0 ? '+' : ''}${b.net_balance !== 0 ? b.net_balance : '—'}
        </td>
      </tr>`).join('')

  const crossDetail = crossRows.length > 0 ? `
  <h2>פירוט שיוכים צולבים (${crossRows.length} רשומות)</h2>
  <table>
    <thead>
      <tr>
        <th>שם עובד</th><th>מ.ע</th><th>מחלקת בית</th>
        <th>עבד ב</th><th>תאריך</th><th>משמרת</th>
      </tr>
    </thead>
    <tbody>
      ${crossRows.map((r) => `
      <tr>
        <td>${r.employee_name}</td>
        <td class="neutral">${r.employee_number ?? '—'}</td>
        <td>${r.home_dept_name}</td>
        <td><span class="badge" style="background:${r.worked_dept_color}">${r.worked_dept_name}</span></td>
        <td class="num">${r.work_date.split('-').reverse().join('/')}</td>
        <td>${DURATION_LABELS[r.duration as DurationType] ?? r.duration}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="neutral" style="margin-top:8px">אין שיוכים צולבים בתקופה זו</p>'

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <title>דוח חודשי – ${monthName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Heebo',Arial,sans-serif;direction:rtl;font-size:12px;color:#111;padding:24px}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}
    h2{font-size:14px;font-weight:600;margin:20px 0 8px;color:#444}
    .subtitle{font-size:12px;color:#666;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{background:#f3f4f6;padding:8px 10px;text-align:right;font-weight:600;font-size:11px;color:#555;border-bottom:1px solid #e5e7eb}
    td{padding:7px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
    .num{text-align:left;font-variant-numeric:tabular-nums}
    .positive{color:#059669;font-weight:600}
    .negative{color:#dc2626;font-weight:600}
    .neutral{color:#6b7280}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;color:#fff}
    .print-date{font-size:10px;color:#999;margin-top:24px}
    @media print{body{padding:12px}@page{size:A4;margin:10mm}}
  </style>
</head>
<body>
  <h1>דוח חודשי – ${monthName}</h1>
  <p class="subtitle">הופק ב-${new Date().toLocaleDateString('he-IL')}</p>
  <h2>סיכום לפי מחלקה</h2>
  <table>
    <thead>
      <tr><th>מחלקה</th><th>שאלה (ימי עובד)</th><th>השאילה (ימי עובד)</th><th>יתרה</th></tr>
    </thead>
    <tbody>${balanceRows}</tbody>
  </table>
  ${crossDetail}
  <p class="print-date">מערכת שיוך עובדים</p>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))<\/script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url), { once: true })
  } else {
    URL.revokeObjectURL(url)
  }
}
