# 산책 경로 추적 (Walk Route Tracking)

> **상태**: 구현 완료, 미배포
> **브랜치**: `claude/map-walking-route-tracking-fVyvR`
> **작성일**: 2026-02-22

## Context

산책 중 GPS 경로를 실시간 추적하고 Leaflet 지도에 표시하는 기능. 산책 시작 시 "경로 추적 시작" 버튼으로 GPS 기록을 시작하고, 이동 경로를 지도에 폴리라인으로 그리며, 30초마다 서버에 자동 저장한다.

모바일 웹 환경에서 백그라운드(앱 전환, 화면 잠금) 시 GPS가 중단되는 문제를 Wake Lock API + Page Visibility API로 대응했다.

---

## 구현 완료 사항

### 핵심 기능
- [x] `WalkTracker` 컴포넌트 (Leaflet 지도 + GPS `watchPosition`)
- [x] Haversine 거리 계산 + 노이즈 필터링 (3m 미만 무시)
- [x] 30초 주기 서버 자동 저장 (`onRouteUpdate` 콜백)
- [x] 기존 경로 복원 (페이지 새로고침 시 `activeWalk.walk_route`에서 복원)

### 백그라운드 대응
- [x] Wake Lock API — 추적 중 화면 꺼짐 방지로 GPS 유지
- [x] Page Visibility API — 백그라운드 진입 시 경로 즉시 저장, 복귀 시 Wake Lock 재요청 + 현재 위치 즉시 취득하여 경로 연결
- [x] 5분 이상 백그라운드 + 5km 초과 이동 시 GPS 오류로 판단하여 무시
- [x] UI 상태 표시 (화면 유지 활성/미지원, 백그라운드 복귀 안내)

---

## 배포 전 확인 필요

- [ ] 실기기 테스트 (iOS Safari, Android Chrome)
- [ ] Wake Lock 동작 확인 (배터리 부족 시 거부 케이스)
- [ ] 장시간 산책(30분+) 시 포인트 누적 성능 확인
- [ ] 백그라운드 5분 이상 → 복귀 시 경로 연결 정상 동작 확인

---

## 알려진 한계

- 웹 브라우저 특성상 OS가 백그라운드 탭을 종료하면 경로 끊김 (네이티브 앱 수준 불가)
- Wake Lock은 화면 꺼짐만 방지하며, 앱 전환 시 일부 기기에서 GPS 중단 가능
- 브라우저를 열어둔 채 사용하는 것이 가장 안정적

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `components/daily-log/WalkTracker.tsx` | GPS 추적 + 지도 표시 + Wake Lock + Visibility 처리 |
