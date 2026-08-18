import { LiftLogPanel } from './lift/LiftLogPanel'
import { LiftOverviewPanel } from './lift/LiftOverviewPanel'
import { LiftProgressPanel } from './lift/LiftProgressPanel'
import { LiftSplitsPanel } from './lift/LiftSplitsPanel'
import { LiftWeightPanel } from './lift/LiftWeightPanel'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
  panel: 'overview' | 'lift' | 'splits' | 'progress' | 'weight'
  onGoLift?: () => void
  onGoSplits?: () => void
}

/** Health lift tabs — React port of personal-lift-tracker. */
export function LiftTrackingPanel({ userId, logDate, tick, refresh, panel, onGoLift, onGoSplits }: Props) {
  if (panel === 'overview') {
    return (
      <LiftOverviewPanel
        userId={userId}
        tick={tick}
        refresh={refresh}
        onGoLift={onGoLift}
        onGoSplits={onGoSplits}
      />
    )
  }
  if (panel === 'lift') return <LiftLogPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} onGoSplits={onGoSplits} />
  if (panel === 'splits') return <LiftSplitsPanel userId={userId} tick={tick} refresh={refresh} onGoLift={onGoLift} />
  if (panel === 'progress') return <LiftProgressPanel userId={userId} tick={tick} />
  return <LiftWeightPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
}
