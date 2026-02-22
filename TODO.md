# TODO / Backlog

## 미배포 기능

### 산책 경로 추적 (Walk Route Tracking)

**브랜치**: `claude/map-walking-route-tracking-fVyvR`
**상태**: 구현 완료, 미배포

#### 구현 완료
- [x] `WalkTracker` 컴포넌트 (Leaflet 지도 + GPS watchPosition)
- [x] Haversine 거리 계산 + 노이즈 필터링 (3m 미만 무시)
- [x] 30초 주기 서버 자동 저장
- [x] Wake Lock API — 추적 중 화면 꺼짐 방지
- [x] Page Visibility API — 백그라운드 진입 시 즉시 저장, 복귀 시 경로 연결
- [x] UI 상태 표시 (화면 유지 활성/미지원, 백그라운드 복귀 안내)

#### 배포 전 확인 필요
- [ ] 실기기 테스트 (iOS Safari, Android Chrome)
- [ ] Wake Lock 동작 확인 (배터리 부족 시 거부 케이스)
- [ ] 장시간 산책 시 포인트 누적 성능 확인
- [ ] 백그라운드 5분 이상 → 복귀 시 경로 연결 정상 동작 확인

#### 알려진 한계
- 웹 브라우저 특성상 OS가 탭을 종료하면 경로 끊김 (네이티브 앱 수준 불가)
- Wake Lock으로 최대한 완화하지만, 브라우저를 열어둔 채 사용 권장

#### 관련 파일
- `components/daily-log/WalkTracker.tsx`
