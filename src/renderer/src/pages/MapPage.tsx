import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function MapPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-1.5, 53.0], // centre on England by default
      zoom: 6
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl())

    map.on('load', async () => {
      const sightings = await window.api.sightings.list()
      const features = sightings
        .filter((s) => s.lat != null && s.lon != null)
        .map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.lon as number, s.lat as number] },
          properties: { species: s.species, date: s.date, count: s.count }
        }))

      map.addSource('sightings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'sightings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#74c0fc', 10, '#339af0', 50, '#1971c2'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30]
        }
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'sightings',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 }
      })

      map.addLayer({
        id: 'unclustered',
        type: 'circle',
        source: 'sightings',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': '#f03e3e', 'circle-radius': 6 }
      })

      map.on('click', 'unclustered', (e) => {
        const props = e.features?.[0]?.properties
        if (!props) return
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${props.species}</strong><br/>${props.date}${props.count ? ` &times;${props.count}` : ''}`)
          .addTo(map)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Map</h1>
      <div ref={containerRef} style={{ flex: 1, borderRadius: 6, overflow: 'hidden' }} />
    </div>
  )
}
