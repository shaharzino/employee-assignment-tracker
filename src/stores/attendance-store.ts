import { create } from 'zustand'
import { DurationType } from '@/types'

export type AttendanceEntry = {
  employeeId: string
  workDate: string
  shift: DurationType
  deptId: string
  isDirty: boolean
  dbId?: string
}

type AttendanceStore = {
  date: string
  entries: Record<string, AttendanceEntry[]>   // key: employeeId
  setDate: (date: string) => void
  setEntry: (employeeId: string, shift: DurationType, deptId: string, dbId?: string) => void
  removeEntry: (employeeId: string, shift: DurationType) => void
  loadEntries: (entries: AttendanceEntry[]) => void
  clearDirty: () => void
  getDirtyEntries: () => AttendanceEntry[]
}

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  date: new Date().toISOString().split('T')[0],
  entries: {},

  setDate: (date) => set({ date, entries: {} }),

  setEntry: (employeeId, shift, deptId, dbId) => {
    set((state) => {
      const existing = state.entries[employeeId] ?? []
      const filtered = existing.filter((e) => e.shift !== shift)
      return {
        entries: {
          ...state.entries,
          [employeeId]: [
            ...filtered,
            {
              employeeId,
              workDate: state.date,
              shift,
              deptId,
              isDirty: true,
              dbId,
            },
          ],
        },
      }
    })
  },

  removeEntry: (employeeId, shift) => {
    set((state) => {
      const existing = state.entries[employeeId] ?? []
      const updated = existing.filter((e) => e.shift !== shift)
      const newEntries = { ...state.entries }
      if (updated.length === 0) {
        delete newEntries[employeeId]
      } else {
        newEntries[employeeId] = updated
      }
      return { entries: newEntries }
    })
  },

  loadEntries: (entries) => {
    const grouped: Record<string, AttendanceEntry[]> = {}
    for (const e of entries) {
      if (!grouped[e.employeeId]) grouped[e.employeeId] = []
      grouped[e.employeeId].push({ ...e, isDirty: false })
    }
    set({ entries: grouped })
  },

  clearDirty: () => {
    set((state) => {
      const entries: Record<string, AttendanceEntry[]> = {}
      for (const [k, v] of Object.entries(state.entries)) {
        entries[k] = v.map((e) => ({ ...e, isDirty: false }))
      }
      return { entries }
    })
  },

  getDirtyEntries: () => {
    const { entries } = get()
    return Object.values(entries).flat().filter((e) => e.isDirty)
  },
}))
