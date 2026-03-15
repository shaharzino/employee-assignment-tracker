'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { DEPT_COLOR_PALETTE } from '@/types'

type ParsedRow = {
  employeeNumber: string
  fullName: string
  deptName: string
}

type ImportResult = {
  added: number
  skipped: number
  newDepts: number
}

export default function ImportEmployeesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const supabase = createClient()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const parsed: ParsedRow[] = []
      for (const row of json) {
        // Handle column name with or without trailing space
        const empNum = String(row['עובד'] ?? row['עובד '] ?? '').trim()
        const name = String(row['שם'] ?? row['שם '] ?? '').trim()
        // Department column may have trailing space
        const deptRaw = Object.keys(row).find((k) => k.trim() === 'מחלקה')
        const dept = String(deptRaw ? row[deptRaw] : '').trim()

        if (empNum && name) {
          parsed.push({ employeeNumber: empNum, fullName: name, deptName: dept })
        }
      }
      setRows(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)

    try {
      // 1. Get existing departments
      const { data: existingDepts } = await supabase
        .from('departments')
        .select('id, name')
      const deptMap = new Map((existingDepts ?? []).map((d) => [d.name.trim(), d.id]))

      // 2. Find new departments (unique names not in DB)
      const uniqueDeptNames = [...new Set(rows.map((r) => r.deptName).filter(Boolean))]
      const newDeptNames = uniqueDeptNames.filter((n) => !deptMap.has(n))

      let newDeptsCount = 0
      if (newDeptNames.length > 0) {
        const colorOffset = existingDepts?.length ?? 0
        const newDepts = newDeptNames.map((name, i) => ({
          name,
          color_hex: DEPT_COLOR_PALETTE[(colorOffset + i) % DEPT_COLOR_PALETTE.length],
          is_active: true,
        }))
        const { data: created, error: deptError } = await supabase
          .from('departments')
          .insert(newDepts)
          .select('id, name')
        if (deptError) throw deptError
        ;(created ?? []).forEach((d) => deptMap.set(d.name.trim(), d.id))
        newDeptsCount = created?.length ?? 0
      }

      // 3. Insert employees (skip duplicates by employee_number)
      const toInsert = rows.map((r) => ({
        full_name: r.fullName,
        employee_number: r.employeeNumber,
        home_dept_id: deptMap.get(r.deptName) ?? null,
        work_days: 'sun_thu' as const,
        is_active: true,
      }))

      const { data: inserted, error: empError } = await supabase
        .from('employees')
        .upsert(toInsert, { onConflict: 'employee_number', ignoreDuplicates: true })
        .select('id')
      if (empError) throw empError

      const addedCount = inserted?.length ?? 0
      const skippedCount = rows.length - addedCount

      setResult({ added: addedCount, skipped: skippedCount, newDepts: newDeptsCount })
      toast.success(`יובאו ${addedCount} עובדים בהצלחה`)
    } catch (err) {
      toast.error('שגיאה בייבוא: ' + (err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const uniqueDepts = [...new Set(rows.map((r) => r.deptName).filter(Boolean))]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/employees')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לעובדים
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">ייבוא עובדים מ-Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          העלה קובץ Excel עם עמודות: <strong>עובד</strong> (מספר), <strong>שם</strong> (שם מלא), <strong>מחלקה</strong> (שם מחלקה)
        </p>
      </div>

      {/* File Upload */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        {fileName ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="h-10 w-10 text-green-600" />
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground">{rows.length} שורות נמצאו</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-10 w-10" />
            <p className="font-medium">לחץ לבחירת קובץ Excel</p>
            <p className="text-xs">xlsx, xls</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">תצוגה מקדימה ({rows.length} עובדים)</h2>
            <div className="text-sm text-muted-foreground">{uniqueDepts.length} מחלקות</div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-start font-medium text-muted-foreground">מספר עובד</th>
                  <th className="px-4 py-2 text-start font-medium text-muted-foreground">שם מלא</th>
                  <th className="px-4 py-2 text-start font-medium text-muted-foreground">מחלקה</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{row.employeeNumber}</td>
                    <td className="px-4 py-2 font-medium">{row.fullName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.deptName || '—'}</td>
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-xs text-muted-foreground">
                      ... ועוד {rows.length - 10} שורות נוספות
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              <Upload className="h-4 w-4" />
              {importing ? 'מייבא...' : `ייבא ${rows.length} עובדים`}
            </Button>
            <Button variant="outline" onClick={() => { setRows([]); setFileName('') }}>
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-lg">
            <CheckCircle2 className="h-6 w-6" />
            הייבוא הושלם בהצלחה!
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{result.added}</div>
              <div className="text-muted-foreground">עובדים נוספו</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{result.skipped}</div>
              <div className="text-muted-foreground">דולגו (כפולים)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.newDepts}</div>
              <div className="text-muted-foreground">מחלקות חדשות</div>
            </div>
          </div>
          <Button onClick={() => router.push('/employees')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            עבור לרשימת עובדים
          </Button>
        </div>
      )}
    </div>
  )
}
