import { useEffect, useRef } from 'react'
import type { GeoPoint } from '../types'
import 'leaflet/dist/leaflet.css'

type Props = {
  path: GeoPoint[]
  className?: string
  follow?: boolean
}

export function CardioMap({ path, className, follow }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    map: import('leaflet').Map
    line: import('leaflet').Polyline
    marker: import('leaflet').CircleMarker
  } | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    let cancelled = false

    void import('leaflet').then((mod) => {
      if (cancelled || !elRef.current) return
      const L = (mod.default ?? mod) as typeof import('leaflet')
      if (mapRef.current) return
      const start = path[0]
      const map = L.map(el, { zoomControl: false, attributionControl: true })
      if (start) map.setView([start.lat, start.lng], 15)
      else map.setView([20, 0], 2)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)
      const line = L.polyline(
        path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#2A9D8F', weight: 4, opacity: 0.9 },
      ).addTo(map)
      const last = path[path.length - 1]
      const marker = L.circleMarker(last ? [last.lat, last.lng] : start ? [start.lat, start.lng] : [20, 0], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#2A9D8F',
        fillOpacity: 1,
      }).addTo(map)
      if (path.length > 1) map.fitBounds(line.getBounds(), { padding: [24, 24] })
      mapRef.current = { map, line, marker }
      requestAnimationFrame(() => map.invalidateSize())
    })

    return () => {
      cancelled = true
      mapRef.current?.map.remove()
      mapRef.current = null
    }
    // Recreate when the container remounts; live updates happen below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const inst = mapRef.current
    if (!inst || path.length === 0) return
    const latlngs = path.map((p) => [p.lat, p.lng] as [number, number])
    inst.line.setLatLngs(latlngs)
    const last = path[path.length - 1]
    if (last) inst.marker.setLatLng([last.lat, last.lng])
    if (follow && last) {
      if (path.length === 1) inst.map.setView([last.lat, last.lng], 16)
      else inst.map.panTo([last.lat, last.lng], { animate: true })
    } else if (path.length > 1) inst.map.fitBounds(inst.line.getBounds(), { padding: [24, 24], maxZoom: 16 })
  }, [path, follow])

  return (
    <div
      ref={elRef}
      className={className}
      style={{ minHeight: 220, borderRadius: 16, overflow: 'hidden' }}
    />
  )
}
