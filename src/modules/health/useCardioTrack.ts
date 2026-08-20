import { useEffect, useState } from 'react'
import {
  bootCardioTrack,
  getCardioTrack,
  subscribeCardioTrack,
  type CardioTrackState,
} from './cardio-track'

export function useCardioTrack(): CardioTrackState {
  const [state, setState] = useState(getCardioTrack)
  useEffect(() => {
    bootCardioTrack()
    return subscribeCardioTrack(setState)
  }, [])
  return state
}
