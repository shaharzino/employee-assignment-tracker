type HebcalEvent = {
  title: string
  date: string
  category: string
}

const cache: Record<string, Set<string>> = {}

export async function getIsraeliHolidays(year: number, month: number): Promise<Set<string>> {
  const key = `${year}-${month}`
  if (cache[key]) return cache[key]

  try {
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&month=${month}&maj=on&nx=on&mf=on&i=on&c=off&geo=none`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    const json = await res.json()

    const holidays = new Set<string>()
    for (const event of (json.items ?? []) as HebcalEvent[]) {
      if (event.category === 'holiday' || event.category === 'roshchodesh') {
        holidays.add(event.date.split('T')[0])
      }
    }

    cache[key] = holidays
    return holidays
  } catch {
    return new Set()
  }
}
