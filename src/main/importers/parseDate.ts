// Attempt to parse a variety of date string formats into ISO 8601 YYYY-MM-DD.
// Returns null when the input cannot be reliably interpreted.
const FORMATS: Array<(s: string) => Date | null> = [
  // ISO 8601
  (s) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}`) : null
  },
  // DD/MM/YYYY or DD-MM-YYYY
  (s) => {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    return m ? new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : null
  },
  // MM/DD/YYYY (US)
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) return null
    const month = parseInt(m[1])
    const day = parseInt(m[2])
    // Only treat as US format when day would be invalid as DD/MM
    if (day > 12) return new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
    return null
  },
  // Excel serial date (number stored as string)
  (s) => {
    const n = parseInt(s)
    if (isNaN(n) || n < 1 || n > 60000) return null
    // Excel epoch: 1 Jan 1900 = serial 1 (with the leap-year 1900 bug accounted for)
    const d = new Date(Date.UTC(1899, 11, 30))
    d.setUTCDate(d.getUTCDate() + n)
    return d
  }
]

export function parseDate(raw: string | number | null): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null

  for (const fn of FORMATS) {
    const d = fn(s)
    if (d && !isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
  }
  return null
}
