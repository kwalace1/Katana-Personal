/** Parse clock-in/out times and return hours worked. */
export function calculateWfmHours(clockIn: string, clockOut: string): number {
  if (!clockIn || !clockOut) return 0

  const parseHm = (s: string): number => {
    const t = s.trim()
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [hStr, mStr] = t.split(':')
      return Number(hStr) * 60 + Number(mStr)
    }
    const d = new Date(t)
    if (!Number.isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes()
    return 0
  }

  const inMins = parseHm(clockIn)
  const outMins = parseHm(clockOut)
  if (outMins <= inMins) return 0
  return (outMins - inMins) / 60
}

export function getWfmTimesheetStatusColor(status: string): string {
  switch (status) {
    case 'Active':
    case 'Clocked In':
      return 'bg-green-500/10 text-green-600 border-green-500/20'
    case 'Clocked Out':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    case 'Pending':
    case 'Pending Approval':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    case 'Approved':
      return 'bg-green-500/10 text-green-600 border-green-500/20'
    case 'Rejected':
      return 'bg-red-500/10 text-red-600 border-red-500/20'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
