'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2, Navigation, AlertCircle, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WalkRoutePoint, WalkRoute, DailyLog } from '@/types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface WalkTrackerProps {
  activeWalk: DailyLog
  onRouteUpdate?: (route: WalkRoute) => void
  onWalkEnd?: (route: WalkRoute) => void
}

// 두 좌표 사이 거리 계산 (Haversine, 미터 단위)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// 전체 경로 거리 계산
function calculateTotalDistance(points: WalkRoutePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
  }
  return Math.round(total)
}

// GPS 추적 간격 (밀리초)
const TRACKING_INTERVAL = 5000 // 5초
// 최소 이동 거리 (미터) - 노이즈 필터링
const MIN_MOVE_DISTANCE = 3
// 백그라운드 복귀 시 누락 구간으로 간주할 최대 시간 (밀리초)
const MAX_GAP_DURATION = 5 * 60 * 1000 // 5분

/**
 * 산책 중 실시간 GPS 경로를 추적하고 지도에 표시하는 컴포넌트
 */
export function WalkTracker({ activeWalk, onRouteUpdate }: WalkTrackerProps) {
  const [points, setPoints] = useState<WalkRoutePoint[]>(() => {
    // 기존 경로가 있으면 복원
    if (activeWalk.walk_route?.coordinates?.length) {
      return activeWalk.walk_route.coordinates
    }
    return []
  })
  const [isTracking, setIsTracking] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isMapExpanded, setIsMapExpanded] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [wasBackgrounded, setWasBackgrounded] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const currentMarkerRef = useRef<L.CircleMarker | null>(null)
  const startMarkerRef = useRef<L.CircleMarker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const pointsRef = useRef<WalkRoutePoint[]>(points)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const backgroundTimestampRef = useRef<number | null>(null)

  // pointsRef는 항상 최신 상태 유지
  useEffect(() => {
    pointsRef.current = points
  }, [points])

  // Wake Lock 요청 — 화면 꺼짐 방지로 GPS 유지
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockActive(true)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false)
        wakeLockRef.current = null
      })
    } catch {
      // 배터리 부족 등의 이유로 거부될 수 있음
      setWakeLockActive(false)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  // Page Visibility — 백그라운드 진입/복귀 처리
  useEffect(() => {
    if (!isTracking) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 백그라운드 진입: 타임스탬프 저장 + 경로 즉시 저장
        backgroundTimestampRef.current = Date.now()
        const currentPoints = pointsRef.current
        if (currentPoints.length >= 2 && onRouteUpdate) {
          onRouteUpdate({
            coordinates: currentPoints,
            distance_meters: calculateTotalDistance(currentPoints),
          })
        }
      } else {
        // 포그라운드 복귀
        const bgTimestamp = backgroundTimestampRef.current
        backgroundTimestampRef.current = null

        // Wake Lock 재요청 (일부 브라우저에서 백그라운드 시 해제됨)
        requestWakeLock()

        // 현재 위치 즉시 취득하여 경로 연결
        if (bgTimestamp) {
          const gapDuration = Date.now() - bgTimestamp
          if (gapDuration > TRACKING_INTERVAL * 2) {
            setWasBackgrounded(true)
            setTimeout(() => setWasBackgrounded(false), 3000)
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              const timestamp = position.timestamp

              setPoints(prev => {
                if (prev.length === 0) return prev
                const last = prev[prev.length - 1]
                const dist = haversineDistance(last.lat, last.lng, latitude, longitude)

                // 너무 먼 거리(5분 이상 이동 불가 거리)는 GPS 오류로 판단
                if (gapDuration > MAX_GAP_DURATION && dist > 5000) return prev
                if (dist < MIN_MOVE_DISTANCE) return prev

                const newPoint: WalkRoutePoint = { lat: latitude, lng: longitude, timestamp }
                const updated = [...prev, newPoint]

                // 지도에 복귀 지점 반영
                const map = mapInstanceRef.current
                if (map) {
                  const latLng: [number, number] = [latitude, longitude]
                  if (polylineRef.current) {
                    polylineRef.current.addLatLng(latLng)
                  }
                  if (currentMarkerRef.current) {
                    currentMarkerRef.current.setLatLng(latLng)
                  }
                  map.panTo(latLng)
                }

                return updated
              })
            },
            () => {
              // 복귀 시 위치 취득 실패 — watchPosition이 이어서 처리
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          )
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isTracking, onRouteUpdate, requestWakeLock])

  // 경과 시간 업데이트
  useEffect(() => {
    const startTime = new Date(activeWalk.logged_at).getTime()
    const updateElapsed = () => {
      const now = Date.now()
      setElapsedMinutes(Math.floor((now - startTime) / 60000))
    }
    updateElapsed()
    const timer = setInterval(updateElapsed, 30000) // 30초마다 업데이트
    return () => clearInterval(timer)
  }, [activeWalk.logged_at])

  // 경로를 서버에 주기적 저장 (30초마다)
  useEffect(() => {
    if (!isTracking) return

    saveTimerRef.current = setInterval(() => {
      const currentPoints = pointsRef.current
      if (currentPoints.length >= 2 && onRouteUpdate) {
        onRouteUpdate({
          coordinates: currentPoints,
          distance_meters: calculateTotalDistance(currentPoints),
        })
      }
    }, 30000) // 30초마다 서버 저장

    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current)
      }
    }
  }, [isTracking, onRouteUpdate])

  // 지도 초기화
  const initMap = useCallback(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      center: [37.5665, 126.978], // 서울 기본값
      zoom: 16,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    // 기존 경로 그리기
    if (pointsRef.current.length > 0) {
      const coords = pointsRef.current.map(p => [p.lat, p.lng] as [number, number])

      const polyline = L.polyline(coords, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.8,
      }).addTo(map)
      polylineRef.current = polyline

      // 시작점
      startMarkerRef.current = L.circleMarker(coords[0], {
        radius: 6,
        color: '#16a34a',
        fillColor: '#22c55e',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)

      // 현재 위치
      const lastCoord = coords[coords.length - 1]
      currentMarkerRef.current = L.circleMarker(lastCoord, {
        radius: 8,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)

      map.fitBounds(polyline.getBounds(), { padding: [30, 30] })
    }
  }, [])

  // 맵 컨테이너가 렌더링되면 초기화
  useEffect(() => {
    if (isMapExpanded) {
      // DOM 렌더링 후 지도 초기화를 위해 약간의 딜레이
      const timer = setTimeout(initMap, 100)
      return () => clearTimeout(timer)
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        polylineRef.current = null
        currentMarkerRef.current = null
        startMarkerRef.current = null
      }
    }
  }, [isMapExpanded, initMap])

  // GPS 추적 시작
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('이 기기에서는 위치 추적을 지원하지 않습니다.')
      return
    }

    setGpsError(null)
    setIsTracking(true)
    setIsMapExpanded(true)
    requestWakeLock()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const timestamp = position.timestamp

        setPoints(prev => {
          const newPoint: WalkRoutePoint = { lat: latitude, lng: longitude, timestamp }

          // 노이즈 필터링: 마지막 점에서 최소 거리 이상 이동했을 때만 추가
          if (prev.length > 0) {
            const last = prev[prev.length - 1]
            const dist = haversineDistance(last.lat, last.lng, latitude, longitude)
            if (dist < MIN_MOVE_DISTANCE) return prev
          }

          const updated = [...prev, newPoint]

          // 지도 업데이트
          const map = mapInstanceRef.current
          if (map) {
            const latLng: [number, number] = [latitude, longitude]

            if (!polylineRef.current) {
              polylineRef.current = L.polyline([latLng], {
                color: '#22c55e',
                weight: 4,
                opacity: 0.8,
              }).addTo(map)
            } else {
              polylineRef.current.addLatLng(latLng)
            }

            if (!startMarkerRef.current && updated.length === 1) {
              startMarkerRef.current = L.circleMarker(latLng, {
                radius: 6,
                color: '#16a34a',
                fillColor: '#22c55e',
                fillOpacity: 1,
                weight: 2,
              }).addTo(map)
            }

            if (currentMarkerRef.current) {
              currentMarkerRef.current.setLatLng(latLng)
            } else {
              currentMarkerRef.current = L.circleMarker(latLng, {
                radius: 8,
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                weight: 2,
              }).addTo(map)
            }

            map.panTo(latLng)
          }

          return updated
        })

        setGpsError(null)
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.')
            break
          case error.POSITION_UNAVAILABLE:
            setGpsError('위치 정보를 사용할 수 없습니다.')
            break
          case error.TIMEOUT:
            setGpsError('위치 요청 시간이 초과되었습니다.')
            break
          default:
            setGpsError('위치를 가져오는 중 오류가 발생했습니다.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: TRACKING_INTERVAL,
      }
    )
  }, [requestWakeLock])

  // GPS 추적 중지
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    releaseWakeLock()

    // 마지막 경로 저장
    if (pointsRef.current.length >= 2 && onRouteUpdate) {
      onRouteUpdate({
        coordinates: pointsRef.current,
        distance_meters: calculateTotalDistance(pointsRef.current),
      })
    }
  }, [onRouteUpdate, releaseWakeLock])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current)
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
      }
    }
  }, [])

  // 현재 경로의 공개 데이터 - 부모에게도 전달
  const currentRoute: WalkRoute = {
    coordinates: points,
    distance_meters: calculateTotalDistance(points),
  }

  const distanceKm = (currentRoute.distance_meters / 1000).toFixed(2)

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
      {/* 산책 정보 헤더 */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐕</span>
            <div>
              <div className="font-medium text-green-800 text-sm">산책 중</div>
              <div className="text-xs text-green-600">{elapsedMinutes}분 경과</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {points.length >= 2 && (
              <div className="text-right">
                <div className="font-medium text-green-800">
                  {Number(distanceKm) >= 1 ? `${distanceKm}km` : `${currentRoute.distance_meters}m`}
                </div>
                <div className="text-xs text-green-600">이동 거리</div>
              </div>
            )}
          </div>
        </div>

        {/* GPS 에러 표시 */}
        {gpsError && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* 추적 컨트롤 */}
        <div className="mt-3 flex gap-2">
          {!isTracking ? (
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={startTracking}
            >
              <Navigation className="w-4 h-4 mr-1.5" />
              경로 추적 시작
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-100"
              onClick={stopTracking}
            >
              <MapPin className="w-4 h-4 mr-1.5" />
              추적 중지
            </Button>
          )}

          {!isMapExpanded && points.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => setIsMapExpanded(true)}
            >
              지도 보기
            </Button>
          )}
          {isMapExpanded && (
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => setIsMapExpanded(false)}
            >
              지도 닫기
            </Button>
          )}
        </div>
      </div>

      {/* 지도 영역 */}
      {isMapExpanded && (
        <div className="border-t border-green-200">
          <div ref={mapRef} style={{ height: '280px', width: '100%' }} />
        </div>
      )}

      {/* 추적 상태 표시 */}
      {isTracking && (
        <div className="px-4 py-2 bg-green-100 border-t border-green-200">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
            <span className="text-xs text-green-700">GPS 경로 기록 중...</span>
            <span className="text-xs text-green-500 ml-auto">{points.length}개 포인트</span>
          </div>
          {/* Wake Lock 상태 */}
          <div className="flex items-center gap-1.5 mt-1">
            <Smartphone className="w-3 h-3 text-green-500" />
            <span className="text-[11px] text-green-600">
              {wakeLockActive ? '화면 유지 활성' : '화면 유지 미지원'}
            </span>
          </div>
          {/* 백그라운드 복귀 안내 */}
          {wasBackgrounded && (
            <div className="mt-1 text-[11px] text-amber-600">
              앱 전환에서 복귀했습니다. 경로를 이어서 기록합니다.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 경로 데이터 유틸리티 함수 (외부에서 사용)
export { calculateTotalDistance, haversineDistance }
