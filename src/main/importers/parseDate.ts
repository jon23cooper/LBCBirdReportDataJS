// Attempt to parse a variety of date string formats into ISO 8601 YYYY-MM-DD.
// Returns null when the input cannot be reliably interpreted.
const FORMATS: Array<(s: string) => Date | null> = [
  // ISO 8601
  (s) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}`) : null
  },
  // DD/MM/YYYY or DD-MM-YYYY (4-digit year)
  (s) => {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    return m ? new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : null
  },
  // DD/MM/YY or DD-MM-YY (2-digit year, mapped to 2000–2099)
  (s) => {
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
    if (!m) return null
    const year = 2000 + parseInt(m[3], 10)
    return new Date(`${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
  },
  // MM/DD/YYYY (US, 4-digit year)
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) return null
    const day = parseInt(m[2])
    // Only treat as US format when day would be invalid as DD/MM
    if (day > 12) return new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
    return null
  },
  // Excel serial date (pure integer string only — guards against parseInt("01/01/2024") = 1)
  (s) => {
    if (!/^\d+$/.test(s)) return null
    const n = parseInt(s, 10)
    if (n < 1 || n > 60000) return null
    // Excel epoch: serial 1 = 1 Jan 1900. Base = 31 Dec 1899.
    const d = new Date(Date.UTC(1899, 11, 31))
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
