import { parseHealthDate, parseAppleHealthSleepXml, parseSleepImportFile, type ImportedSleepNight } from './sleep-import'

export type ImportedWorkout = {
  date: string
  activity: string
  duration_minutes: number
  notes: string
  source: 'apple_health'
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`))
  return m?.[1] ?? null
}

function workoutLabel(raw: string): string {
  const type = raw.replace(/^HKWorkoutActivityType/, '').replace(/([A-Z])/g, ' $1').trim()
  return type || 'Workout'
}

export function parseAppleHealthWorkoutsXml(xml: string): ImportedWorkout[] {
  const out: ImportedWorkout[] = []
  const re = /<Workout\b[^>]*\/?>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) {
    const tag = match[0]
    const start = parseHealthDate(attr(tag, 'startDate') || '')
    const end = parseHealthDate(attr(tag, 'endDate') || '')
    if (!start) continue
    const durationRaw = attr(tag, 'duration')
    const durationUnit = (attr(tag, 'durationUnit') || 'min').toLowerCase()
    let minutes = durationRaw ? Number(durationRaw) : 0
    if (!Number.isFinite(minutes) || minutes <= 0) {
      if (end) minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000))
    }
    if (durationUnit.startsWith('sec')) minutes = minutes / 60
    if (durationUnit.startsWith('hr') || durationUnit.startsWith('hour')) minutes = minutes * 60
    minutes = Math.max(1, Math.round(minutes))
    out.push({
      date: start.toISOString().slice(0, 10),
      activity: workoutLabel(attr(tag, 'workoutActivityType') || 'Workout'),
      duration_minutes: minutes,
      notes: 'Imported from Apple Health',
      source: 'apple_health',
    })
  }
  return out
}

export function parseHealthExportFile(
  filename: string,
  text: string,
): { sleepNights: ImportedSleepNight[]; workouts: ImportedWorkout[] } {
  const lower = filename.toLowerCase()
  const isAppleXml = lower.endsWith('.xml') || /<HealthData|<Record\b|<Workout\b/i.test(text)
  if (isAppleXml) {
    return {
      sleepNights: parseAppleHealthSleepXml(text),
      workouts: parseAppleHealthWorkoutsXml(text),
    }
  }
  return {
    sleepNights: parseSleepImportFile(filename, text),
    workouts: [],
  }
}
