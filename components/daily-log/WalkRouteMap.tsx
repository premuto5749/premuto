'use client'

import { useEffect, useRef } from 'react'
import type { WalkRoute } from '@/types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface WalkRouteMapProps {
  route: WalkRoute
  height?: string
  className?: string
}

/**
 * 완료된 산책의 경로를 지도 위에 표시하는 컴포넌트
 * Leaflet을 직접 사용 (SSR 호환)
 */
export function WalkRouteMap({ route, height = '200px', className = '' }: WalkRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || !route.coordinates || route.coordinates.length === 0) return

    // 이미 맵이 있으면 제거
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const coords = route.coordinates.map(p => [p.lat, p.lng] as [number, number])

    // 지도 생성
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    })

    mapInstanceRef.current = map

    // OpenStreetMap 타일
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    // 경로 폴리라인
    const polyline = L.polyline(coords, {
      color: '#22c55e',
      weight: 4,
      opacity: 0.8,
    }).addTo(map)

    // 시작점 마커 (녹색 원)
    L.circleMarker(coords[0], {
      radius: 6,
      color: '#16a34a',
      fillColor: '#22c55e',
      fillOpacity: 1,
      weight: 2,
    }).addTo(map)

    // 끝점 마커 (빨간 원)
    if (coords.length > 1) {
      L.circleMarker(coords[coords.length - 1], {
        radius: 6,
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
    }

    // 경로에 맞춰 줌
    map.fitBounds(polyline.getBounds(), { padding: [20, 20] })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [route])

  if (!route.coordinates || route.coordinates.length === 0) {
    return null
  }

  const distanceKm = (route.distance_meters / 1000).toFixed(2)

  return (
    <div className={className}>
      <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-lg overflow-hidden" />
      <div className="flex justify-between items-center mt-1.5 px-1">
        <span className="text-xs text-muted-foreground">
          총 거리: {Number(distanceKm) >= 1 ? `${distanceKm}km` : `${route.distance_meters}m`}
        </span>
        <span className="text-xs text-muted-foreground">
          {route.coordinates.length}개 위치 기록
        </span>
      </div>
    </div>
  )
}
