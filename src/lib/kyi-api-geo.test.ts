import { describe, expect, it } from 'vitest'
import {
  distanceMiles,
  leadInAnyGeoCircle,
  leadInGeoTargetingArea,
  leadCoordinatesMatchState,
  type GeoCircle,
} from './kyi-api'

const RALEIGH: GeoCircle = {
  centerLat: 35.7721,
  centerLng: -78.63861,
  radiusMiles: 95,
}

describe('kyi geo radius filtering', () => {
  it('includes leads within the configured radius of Raleigh', () => {
    // Durham, NC (~25 mi from Raleigh)
    expect(
      leadInAnyGeoCircle({ lat: 35.994, lng: -78.8986 }, [RALEIGH]),
    ).toBe(true)
  })

  it('excludes leads outside the radius', () => {
    expect(
      leadInAnyGeoCircle({ lat: 34.0522, lng: -118.2437 }, [RALEIGH]),
    ).toBe(false) // Los Angeles, CA
    expect(
      leadInAnyGeoCircle({ lat: 41.8781, lng: -87.6298 }, [RALEIGH]),
    ).toBe(false) // Chicago, IL
    expect(
      leadInAnyGeoCircle({ lat: 40.7128, lng: -74.006 }, [RALEIGH]),
    ).toBe(false) // New York, NY
  })

  it('excludes leads without coordinates', () => {
    expect(leadInAnyGeoCircle({ lat: null, lng: null }, [RALEIGH])).toBe(false)
  })

  it('returns false when no geo circles are configured', () => {
    expect(leadInAnyGeoCircle({ lat: 35.994, lng: -78.8986 }, [])).toBe(false)
  })

  it('matches when lead is within any active market circle', () => {
    const sfMarket: GeoCircle = {
      centerLat: 37.7749,
      centerLng: -122.4194,
      radiusMiles: 50,
    }
    expect(
      leadInAnyGeoCircle({ lat: 37.8044, lng: -122.2712 }, [RALEIGH, sfMarket]),
    ).toBe(true) // Oakland, CA — outside Raleigh but inside SF roadshow market
  })

  it('computes haversine distance in miles', () => {
    const d = distanceMiles(RALEIGH.centerLat, RALEIGH.centerLng, 35.994, -78.8986)
    expect(d).toBeGreaterThan(20)
    expect(d).toBeLessThan(35)
  })

  it('rejects Hillsborough CA label when coords are pinned to Hillsborough NC', () => {
    const hillsboroughNcCoords = { lat: 36.07542, lng: -79.09973, state: 'California' }
    expect(leadCoordinatesMatchState(hillsboroughNcCoords)).toBe(false)
    expect(leadInGeoTargetingArea(hillsboroughNcCoords, [RALEIGH])).toBe(false)
    // NC coords with NC state pass radius + state check
    expect(
      leadInGeoTargetingArea({ lat: 36.07542, lng: -79.09973, state: 'NC' }, [RALEIGH]),
    ).toBe(true)
  })

  it('accepts Hillsborough CA when coords are in California', () => {
    const hillsboroughCa = { lat: 37.5741, lng: -122.37942, state: 'CA' }
    expect(leadCoordinatesMatchState(hillsboroughCa)).toBe(true)
    expect(leadInGeoTargetingArea(hillsboroughCa, [RALEIGH])).toBe(false)
  })
})
