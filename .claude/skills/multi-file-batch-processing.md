# Multi-File Batch Processing Pattern (다중 파일 배치 처리 패턴)

여러 파일을 한 번에 업로드하여 **자동 그룹화 → 병렬 처리 → 독립 저장**하는 패턴.

## 핵심 원칙

1. **자동 그룹화**: 파일 메타데이터(날짜, 출처 등)를 기준으로 자동 분류
2. **병렬 처리**: 독립적인 작업은 동시에 처리하여 성능 최적화
3. **독립 트랜잭션**: 각 그룹은 별도 트랜잭션으로 저장 (한 그룹 실패가 다른 그룹에 영향 없음)
4. **추적성 유지**: 각 결과의 원본 파일을 추적 가능

## 처리 흐름

```
[다중 파일 업로드] (최대 N개)
        ↓
[병렬 메타데이터 추출]
  ├── 파일1 → { date, source, ... }
  ├── 파일2 → { date, source, ... }
  └── 파일N → { date, source, ... }
        ↓
[자동 그룹화] (날짜 + 출처 기준)
  ├── 그룹A: 파일1, 파일3 (같은 날짜+출처)
  └── 그룹B: 파일2 (다른 날짜)
        ↓
[그룹별 탭 UI 생성]
        ↓
[사용자 검토/수정]
        ↓
[그룹별 병렬 저장] (독립 트랜잭션)
```

## 데이터 구조

### 업로드 배치

```typescript
interface UploadBatch {
  batchId: string;
  uploadedAt: Date;
  files: UploadedFile[];
  groups: FileGroup[];
  status: 'processing' | 'ready' | 'saving' | 'completed' | 'partial_error';
}

interface UploadedFile {
  filename: string;
  size: number;
  type: string;
  metadata: ExtractedMetadata;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface ExtractedMetadata {
  date?: string;
  source?: string;
  [key: string]: any;
}

interface FileGroup {
  groupId: string;
  groupKey: string;  // "2025-01-15_병원A"
  label: string;     // "2025-01-15 (병원A)"
  files: UploadedFile[];
  data: ProcessedData[];
  status: 'pending' | 'ready' | 'saving' | 'saved' | 'error';
}
```

## 그룹화 로직

```typescript
function groupFilesByMetadata(files: UploadedFile[]): FileGroup[] {
  const groups = new Map<string, UploadedFile[]>();

  for (const file of files) {
    const { date, source } = file.metadata;
    const groupKey = `${date || 'unknown'}_${source || 'unknown'}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(file);
  }

  // 같은 키에 여러 그룹이 있으면 순번 부여
  const result: FileGroup[] = [];
  const keyCount = new Map<string, number>();

  for (const [key, groupFiles] of groups) {
    const count = (keyCount.get(key) || 0) + 1;
    keyCount.set(key, count);

    const [date, source] = key.split('_');
    const label = count > 1
      ? `${date} (${source}) (${count})`
      : `${date} (${source})`;

    result.push({
      groupId: generateId(),
      groupKey: key,
      label,
      files: groupFiles,
      data: [],
      status: 'pending'
    });
  }

  return result;
}
```

## 병렬 처리

```typescript
async function processFilesInParallel(files: UploadedFile[]): Promise<void> {
  const results = await Promise.allSettled(
    files.map(file => processFile(file))
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      files[index].processingStatus = 'completed';
      files[index].metadata = result.value;
    } else {
      files[index].processingStatus = 'error';
      files[index].error = result.reason.message;
    }
  });
}
```

## 그룹별 독립 저장

```typescript
async function saveGroupsIndependently(groups: FileGroup[]): Promise<SaveResult[]> {
  const results = await Promise.allSettled(
    groups.map(group => saveGroupWithTransaction(group))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      groups[index].status = 'saved';
      return { groupId: groups[index].groupId, success: true, recordId: result.value };
    } else {
      groups[index].status = 'error';
      return { groupId: groups[index].groupId, success: false, error: result.reason.message };
    }
  });
}

async function saveGroupWithTransaction(group: FileGroup): Promise<string> {
  const { data, error } = await supabase.rpc('save_group_atomic', {
    group_data: group.data,
    metadata: {
      date: group.files[0].metadata.date,
      source: group.files[0].metadata.source,
      files: group.files.map(f => f.filename)
    }
  });

  if (error) throw error;
  return data.recordId;
}
```

## 중복 항목 처리

같은 그룹 내에서 같은 항목이 여러 파일에 있는 경우:

```typescript
interface DuplicateConflict {
  itemKey: string;
  values: Array<{
    value: any;
    sourceFile: string;
  }>;
}

function detectDuplicates(group: FileGroup): DuplicateConflict[] {
  const itemMap = new Map<string, Array<{ value: any; sourceFile: string }>>();

  for (const file of group.files) {
    for (const item of file.processedData) {
      const key = item.standardItemId;
      if (!itemMap.has(key)) {
        itemMap.set(key, []);
      }
      itemMap.get(key)!.push({
        value: item.value,
        sourceFile: file.filename
      });
    }
  }

  return Array.from(itemMap.entries())
    .filter(([_, values]) => values.length > 1 && !allValuesEqual(values))
    .map(([key, values]) => ({ itemKey: key, values }));
}
```

## UI 컴포넌트

### 1. 업로드 영역

```tsx
function FileDropzone({ onUpload, maxFiles = 10 }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onUpload,
    maxFiles,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.png'] }
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed p-8 rounded-lg
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
    >
      <input {...getInputProps()} />
      <p>파일을 드래그하거나 클릭하여 업로드 (최대 {maxFiles}개)</p>
    </div>
  );
}
```

### 2. 그룹 탭 UI

```tsx
function GroupTabs({ groups }: { groups: FileGroup[] }) {
  const [activeTab, setActiveTab] = useState(groups[0]?.groupId);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {groups.map(group => (
          <TabsTrigger key={group.groupId} value={group.groupId}>
            {group.label}
            <StatusBadge status={group.status} />
          </TabsTrigger>
        ))}
      </TabsList>

      {groups.map(group => (
        <TabsContent key={group.groupId} value={group.groupId}>
          <GroupDataTable group={group} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

### 3. 진행률 표시

```tsx
function BatchProgress({ batch }: { batch: UploadBatch }) {
  const completed = batch.files.filter(f => f.processingStatus === 'completed').length;
  const total = batch.files.length;

  return (
    <div>
      <Progress value={(completed / total) * 100} />
      <p>파일 {completed}/{total} 처리 완료</p>

      {batch.groups.length > 0 && (
        <p>{batch.groups.length}개 그룹으로 분류됨</p>
      )}
    </div>
  );
}
```

## 에러 처리

```typescript
interface BatchResult {
  success: boolean;
  totalGroups: number;
  savedGroups: number;
  failedGroups: number;
  errors: Array<{
    groupId: string;
    groupLabel: string;
    error: string;
  }>;
}

function summarizeBatchResult(results: SaveResult[], groups: FileGroup[]): BatchResult {
  const saved = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  return {
    success: failed.length === 0,
    totalGroups: groups.length,
    savedGroups: saved,
    failedGroups: failed.length,
    errors: failed.map(r => ({
      groupId: r.groupId,
      groupLabel: groups.find(g => g.groupId === r.groupId)?.label || '',
      error: r.error!
    }))
  };
}
```

## 적용 도메인

| 도메인 | 파일 유형 | 그룹화 기준 |
|--------|----------|------------|
| 의료 검사 | 검사 결과지 PDF | 검사 날짜 + 병원 |
| 회계 | 영수증 이미지 | 거래 날짜 + 업체 |
| 법률 | 계약서 문서 | 계약 일자 + 당사자 |
| 물류 | 송장 스캔 | 배송 날짜 + 창고 |

## 참고

이 패턴은 Premuto 프로젝트의 혈액검사 다중 업로드 기능에서 도출되었습니다.
여러 날짜의 검사 결과지를 한 번에 업로드하면 날짜별로 자동 그룹화되어 각각 독립적인 검사 기록으로 저장됩니다.
