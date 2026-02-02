# Daily Log Timeline Pattern (일일 기록 타임라인 패턴)

빠른 **원터치 기록 입력 → 시간순 타임라인 표시 → 자동 통계 집계** 패턴.
건강 기록, 업무 일지, 활동 추적 등에 활용.

## 핵심 원칙

1. **최소 탭 입력**: 자주 쓰는 기록은 원터치(1~2탭)로 완료
2. **실시간 피드백**: 기록 즉시 타임라인에 반영
3. **자동 집계**: 일일/주간/월간 통계 자동 계산
4. **내보내기 지원**: 클립보드, 파일 등으로 공유 가능

## 데이터 구조

### 카테고리 정의

```typescript
interface LogCategory {
  id: string;
  name: string;
  nameKo: string;
  icon: string;
  unit: string;
  inputType: 'quick' | 'amount' | 'amount_with_name' | 'number';
  color: string;
}

const CATEGORIES: LogCategory[] = [
  { id: 'meal', name: 'Meal', nameKo: '식사', icon: '🍚', unit: 'g', inputType: 'amount', color: 'orange' },
  { id: 'water', name: 'Water', nameKo: '음수', icon: '💧', unit: 'ml', inputType: 'amount', color: 'blue' },
  { id: 'medicine', name: 'Medicine', nameKo: '약', icon: '💊', unit: '정', inputType: 'amount_with_name', color: 'purple' },
  { id: 'poop', name: 'Poop', nameKo: '배변', icon: '💩', unit: '회', inputType: 'quick', color: 'brown' },
  { id: 'pee', name: 'Pee', nameKo: '배뇨', icon: '🚽', unit: '회', inputType: 'quick', color: 'yellow' },
  { id: 'breathing', name: 'Breathing', nameKo: '호흡수', icon: '🫁', unit: '회/분', inputType: 'number', color: 'teal' },
];
```

### 로그 레코드

```typescript
interface DailyLog {
  id: string;
  userId: string;
  category: string;
  loggedAt: Date;      // 기록 시간
  amount?: number;     // 양 (g, ml, 정 등)
  itemName?: string;   // 항목명 (약 이름 등)
  note?: string;       // 메모
  imageUrl?: string;   // 첨부 이미지
  createdAt: Date;
  updatedAt: Date;
}
```

### 일일 통계

```typescript
interface DailyStats {
  date: string;
  stats: {
    [categoryId: string]: {
      count: number;       // 기록 횟수
      totalAmount: number; // 총량 (해당되는 경우)
      average?: number;    // 평균 (호흡수 등)
    };
  };
}
```

## 데이터베이스 스키마

```sql
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  logged_at TIMESTAMP NOT NULL,
  amount NUMERIC,
  item_name VARCHAR(200),
  note TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 날짜별 조회 최적화
CREATE INDEX idx_daily_logs_user_date
  ON daily_logs(user_id, DATE(logged_at));

-- 카테고리별 조회
CREATE INDEX idx_daily_logs_category
  ON daily_logs(user_id, category, logged_at);
```

## API 엔드포인트

```typescript
// GET /api/daily-logs?date=2025-01-15
// 특정 날짜의 기록 조회
interface GetLogsResponse {
  logs: DailyLog[];
  stats: DailyStats;
}

// GET /api/daily-logs?date=2025-01-15&stats=true
// 통계만 조회
interface GetStatsResponse {
  stats: DailyStats;
}

// POST /api/daily-logs
// 새 기록 추가
interface CreateLogRequest {
  category: string;
  loggedAt?: string;  // 생략 시 현재 시간
  amount?: number;
  itemName?: string;
  note?: string;
}

// PATCH /api/daily-logs/:id
// 기록 수정
interface UpdateLogRequest {
  amount?: number;
  itemName?: string;
  note?: string;
}

// DELETE /api/daily-logs/:id
// 기록 삭제
```

## 통계 집계 쿼리

```sql
-- 일일 통계 조회
SELECT
  category,
  COUNT(*) as count,
  COALESCE(SUM(amount), 0) as total_amount,
  CASE
    WHEN category = 'breathing' THEN AVG(amount)
    ELSE NULL
  END as average
FROM daily_logs
WHERE user_id = $1
  AND DATE(logged_at) = $2
GROUP BY category;
```

## UI 컴포넌트

### 1. 빠른 입력 버튼

```tsx
function QuickAddButton({ category, onAdd }: QuickAddProps) {
  const handleQuickAdd = async () => {
    if (category.inputType === 'quick') {
      // 원터치 기록 (배변, 배뇨 등)
      await createLog({ category: category.id });
    } else {
      // 입력 모달 열기
      openInputModal(category);
    }
  };

  return (
    <button
      onClick={handleQuickAdd}
      className={`p-4 rounded-lg bg-${category.color}-100`}
    >
      <span className="text-2xl">{category.icon}</span>
      <span>{category.nameKo}</span>
    </button>
  );
}
```

### 2. 타임라인 표시

```tsx
function Timeline({ logs }: { logs: DailyLog[] }) {
  const sortedLogs = logs.sort((a, b) =>
    new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  );

  return (
    <div className="space-y-2">
      {sortedLogs.map(log => (
        <TimelineItem key={log.id} log={log} />
      ))}
    </div>
  );
}

function TimelineItem({ log }: { log: DailyLog }) {
  const category = CATEGORIES.find(c => c.id === log.category)!;
  const time = format(new Date(log.loggedAt), 'HH:mm');

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
      <span className="text-xl">{category.icon}</span>
      <span className="text-gray-500">{time}</span>
      <span className="font-medium">
        {category.nameKo}
        {log.amount && ` ${log.amount}${category.unit}`}
        {log.itemName && ` (${log.itemName})`}
      </span>
      {log.note && <span className="text-gray-400">{log.note}</span>}
    </div>
  );
}
```

### 3. 일일 통계 카드

```tsx
function DailyStatsCard({ stats }: { stats: DailyStats }) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
      {CATEGORIES.map(cat => {
        const stat = stats.stats[cat.id];
        if (!stat) return null;

        return (
          <div key={cat.id} className="text-center">
            <span className="text-2xl">{cat.icon}</span>
            <div className="font-bold">
              {cat.inputType === 'quick'
                ? `${stat.count}회`
                : `${stat.totalAmount}${cat.unit}`}
            </div>
            {stat.average && (
              <div className="text-sm text-gray-500">
                평균 {stat.average.toFixed(0)}{cat.unit}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### 4. 날짜 선택 캘린더

```tsx
function DateSelector({ date, onChange }: DateSelectorProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const isToday = isSameDay(date, new Date());

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setShowCalendar(true)}>
        {format(date, 'yyyy년 M월 d일 EEEE', { locale: ko })}
      </button>

      {!isToday && (
        <button onClick={() => onChange(new Date())}>
          오늘로 이동
        </button>
      )}

      {showCalendar && (
        <Calendar
          value={date}
          onChange={(d) => { onChange(d); setShowCalendar(false); }}
          locale="ko"
        />
      )}
    </div>
  );
}
```

## 내보내기 포맷

### 클립보드 텍스트

```typescript
function generateExportText(date: Date, logs: DailyLog[], stats: DailyStats): string {
  const dateStr = format(date, 'yyyy년 M월 d일 EEEE', { locale: ko });

  let text = `📋 ${dateStr} 기록\n\n`;

  // 요약
  text += `📊 오늘 요약\n`;
  for (const cat of CATEGORIES) {
    const stat = stats.stats[cat.id];
    if (stat && stat.count > 0) {
      if (cat.inputType === 'quick') {
        text += `${cat.icon} ${cat.nameKo}: ${stat.count}회\n`;
      } else if (stat.average) {
        text += `${cat.icon} ${cat.nameKo}: 평균 ${stat.average.toFixed(0)}${cat.unit} (${stat.count}회 측정)\n`;
      } else {
        text += `${cat.icon} ${cat.nameKo}: ${stat.totalAmount}${cat.unit} (${stat.count}회)\n`;
      }
    }
  }

  // 상세 기록
  text += `\n📝 상세 기록\n`;
  const sortedLogs = logs.sort((a, b) =>
    new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );

  for (const log of sortedLogs) {
    const cat = CATEGORIES.find(c => c.id === log.category)!;
    const time = format(new Date(log.loggedAt), 'HH:mm');
    let line = `${time} | ${cat.icon} ${cat.nameKo}`;
    if (log.amount) line += ` ${log.amount}${cat.unit}`;
    if (log.itemName) line += ` (${log.itemName})`;
    if (log.note) line += ` - ${log.note}`;
    text += line + '\n';
  }

  return text;
}
```

### 내보내기 예시

```
📋 2025년 1월 15일 수요일 기록

📊 오늘 요약
🍚 식사: 150g (2회)
💧 음수: 300ml (3회)
💊 약: 2회
💩 배변: 1회
🚽 배뇨: 3회
🫁 호흡수: 평균 24회/분 (2회 측정)

📝 상세 기록
08:30 | 🍚 식사 75g
09:00 | 💊 약 1정 (심장약)
10:15 | 💧 음수 100ml
12:00 | 🍚 식사 75g
...
```

## 인라인 수정

```tsx
function EditableLogItem({ log, onUpdate }: EditableLogItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(log.amount);

  const handleSave = async () => {
    await updateLog(log.id, { amount });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-20 border rounded px-2"
        />
        <button onClick={handleSave}>저장</button>
        <button onClick={() => setIsEditing(false)}>취소</button>
      </div>
    );
  }

  return (
    <div onClick={() => setIsEditing(true)} className="cursor-pointer">
      {log.amount}{CATEGORIES.find(c => c.id === log.category)?.unit}
    </div>
  );
}
```

## 적용 도메인

| 도메인 | 카테고리 예시 | 통계 항목 |
|--------|-------------|----------|
| 반려동물 건강 | 식사, 음수, 배변, 약 | 일일 섭취량, 배변 횟수 |
| 운동 기록 | 걷기, 달리기, 헬스 | 운동 시간, 칼로리 |
| 습관 추적 | 물 마시기, 명상, 독서 | 달성률, 연속 일수 |
| 아기 돌봄 | 수유, 기저귀, 수면 | 수유량, 수면 시간 |
| 업무 일지 | 회의, 코딩, 리뷰 | 작업 시간, 항목별 비율 |

## 참고

이 패턴은 Premuto 프로젝트의 일일 건강 기록 기능에서 도출되었습니다.
반려동물의 식사, 음수, 약, 배변 등을 빠르게 기록하고 일일 통계를 확인할 수 있습니다.
