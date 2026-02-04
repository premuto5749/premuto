'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppHeader } from '@/components/layout/AppHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Loader2, Plus, Pencil, Search, RefreshCw, Trash2, Tag,
  Database, ShieldCheck, ArrowLeft, Upload, Download, FileSpreadsheet,
  AlertTriangle, Info, CheckCircle, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface StandardItem {
  id: string
  name: string
  display_name_ko: string | null
  default_unit: string | null
  category: string | null
  exam_type: string | null
  organ_tags: string[] | null
  description_common: string | null
  description_high: string | null
  description_low: string | null
}

interface ItemAlias {
  id: string
  alias: string
  canonical_name: string
  source_hint: string | null
  standard_item_id: string
  standard_items_master?: {
    id: string
    name: string
    display_name_ko: string | null
  }
}

interface SyncStatus {
  current: {
    standardItems: number
    itemAliases: number
    itemMappings: number
  }
  masterData: {
    testItems: number
    aliases: number
  }
  comparison: {
    missingInDb: string[]
    extraInDb: string[]
    missingCount: number
    extraCount: number
  }
}

interface SyncResult {
  success: boolean
  mode: string
  items: { inserted: number; updated: number; skipped: number }
  aliases: { inserted: number; skipped: number }
}

interface ImportResult {
  success: boolean
  items: { total: number; inserted: number; updated: number; failed: number }
  aliases: { total: number; inserted: number; skipped: number; failed: number }
  errors: string[]
}

const EXAM_TYPE_OPTIONS = [
  'Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas',
  'Coagulation', '뇨검사', '안과검사', 'Echo'
]

const ORGAN_TAG_OPTIONS = [
  '기본신체', '혈액', '간', '신장', '췌장', '심장', '전해질', '산염기',
  '호흡', '지혈', '면역', '염증', '대사', '내분비', '근육', '뼈',
  '담도', '영양', '알레르기', '감염', '안과'
]

export default function AdminMasterDataPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [items, setItems] = useState<StandardItem[]>([])
  const [aliases, setAliases] = useState<ItemAlias[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterExamType, setFilterExamType] = useState<string>('all')

  // 모달 상태
  const [editingItem, setEditingItem] = useState<StandardItem | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newItem, setNewItem] = useState({
    name: '',
    display_name_ko: '',
    default_unit: '',
    exam_type: 'Chemistry',
    organ_tags: [] as string[],
    description_common: '',
    description_high: '',
    description_low: '',
  })

  // 별칭 모달 상태
  const [isAddAliasModalOpen, setIsAddAliasModalOpen] = useState(false)
  const [newAlias, setNewAlias] = useState({ alias: '', canonical_name: '', source_hint: '' })
  const [savingAlias, setSavingAlias] = useState(false)

  // 마스터 데이터 동기화 상태
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [fullResetDialogOpen, setFullResetDialogOpen] = useState(false)

  // Excel import/export 상태
  const [excelExporting, setExcelExporting] = useState(false)
  const [excelImporting, setExcelImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const excelFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [itemsRes, aliasesRes] = await Promise.all([
        fetch('/api/admin/standard-items'),
        fetch('/api/admin/item-aliases')
      ])

      if (itemsRes.status === 403 || aliasesRes.status === 403) {
        setAuthorized(false)
        return
      }

      const [itemsData, aliasesData] = await Promise.all([
        itemsRes.json(),
        aliasesRes.json()
      ])

      setAuthorized(true)
      setItems(itemsData.data || [])
      setAliases(aliasesData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 마스터 데이터 상태 조회
  const loadSyncStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/admin/sync-master-data')
      const data = await res.json()
      setSyncStatus(data)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    } finally {
      setLoadingStatus(false)
    }
  }

  // 마스터 데이터 동기화 (safe 모드: 신규만 추가)
  const handleSafeSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/admin/sync-master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      })
      const data = await res.json()
      setSyncResult({
        success: data.success,
        mode: 'safe',
        items: { inserted: data.items.inserted, updated: data.items.updated, skipped: data.items.skipped },
        aliases: { inserted: data.aliases.inserted, skipped: data.aliases.skipped }
      })
      loadSyncStatus()
      fetchData()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  // 마스터 데이터 전체 동기화 (full 모드: 덮어쓰기)
  const handleFullSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setFullResetDialogOpen(false)
    try {
      const res = await fetch('/api/admin/sync-master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full' })
      })
      const data = await res.json()
      setSyncResult({
        success: data.success,
        mode: 'full',
        items: { inserted: data.items.inserted, updated: data.items.updated, skipped: data.items.skipped },
        aliases: { inserted: data.aliases.inserted, skipped: data.aliases.skipped }
      })
      loadSyncStatus()
      fetchData()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Excel 내보내기
  const handleExcelExport = async () => {
    setExcelExporting(true)
    try {
      const response = await fetch('/api/standard-items/export-excel')
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `master-standard-items-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Excel export failed:', error)
      alert('Excel 내보내기에 실패했습니다.')
    } finally {
      setExcelExporting(false)
    }
  }

  // Excel 가져오기
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExcelImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/standard-items/import-excel', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      setImportResult(data)
      fetchData()
    } catch (error) {
      console.error('Excel import failed:', error)
      setImportResult({
        success: false,
        items: { total: 0, inserted: 0, updated: 0, failed: 0 },
        aliases: { total: 0, inserted: 0, skipped: 0, failed: 0 },
        errors: ['Excel 가져오기에 실패했습니다.']
      })
    } finally {
      setExcelImporting(false)
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = ''
      }
    }
  }

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/admin/standard-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '추가 실패')
      }

      setIsAddModalOpen(false)
      setNewItem({
        name: '',
        display_name_ko: '',
        default_unit: '',
        exam_type: 'Chemistry',
        organ_tags: [],
        description_common: '',
        description_high: '',
        description_low: '',
      })
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '추가 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/standard-items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem)
      })

      if (!res.ok) throw new Error('저장 실패')

      setIsEditModalOpen(false)
      setEditingItem(null)
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/standard-items/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '삭제 실패')
      }

      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제 실패')
    }
  }

  const handleAddAlias = async () => {
    if (!newAlias.alias.trim() || !newAlias.canonical_name.trim()) return

    setSavingAlias(true)
    try {
      const res = await fetch('/api/admin/item-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlias)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '추가 실패')
      }

      setIsAddAliasModalOpen(false)
      setNewAlias({ alias: '', canonical_name: '', source_hint: '' })
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : '추가 실패')
    } finally {
      setSavingAlias(false)
    }
  }

  const handleDeleteAlias = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/item-aliases?id=${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('삭제 실패')
      fetchData()
    } catch {
      alert('삭제 실패')
    }
  }

  const toggleOrganTag = (tag: string, currentTags: string[] | null, setter: (tags: string[]) => void) => {
    const tags = currentTags || []
    if (tags.includes(tag)) {
      setter(tags.filter(t => t !== tag))
    } else {
      setter([...tags, tag])
    }
  }

  // 필터링
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.display_name_ko && item.display_name_ko.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesExamType = filterExamType === 'all' ||
      item.exam_type === filterExamType

    return matchesSearch && matchesExamType
  })

  const examTypeStats: Record<string, number> = {}
  items.forEach(item => {
    const type = item.exam_type || 'Other'
    examTypeStats[type] = (examTypeStats[type] || 0) + 1
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="마스터 데이터 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="마스터 데이터 관리" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">접근 권한 없음</CardTitle>
              <CardDescription>관리자 권한이 필요합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>메인으로 돌아가기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="마스터 데이터 관리" />

      <div className="container max-w-7xl mx-auto py-6 px-4">
        {/* 상단 네비게이션 */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-1" />
              관리자 대시보드
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-primary">
            <ShieldCheck className="w-4 h-4" />
            관리자 모드 - 변경사항은 모든 사용자에게 적용됩니다
          </div>
        </div>

        {/* 마스터 데이터 관리 도구 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* 마스터 데이터 동기화 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="w-4 h-4" />
                마스터 데이터 동기화
              </CardTitle>
              <CardDescription className="text-xs">
                코드에 정의된 마스터 데이터를 DB에 동기화합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {syncStatus ? (
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>현재 표준항목</span>
                    <span className="font-medium">{syncStatus.current.standardItems}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span>마스터 데이터</span>
                    <span className="font-medium text-blue-600">
                      {syncStatus.masterData.testItems}개 항목 / {syncStatus.masterData.aliases}개 별칭
                    </span>
                  </div>
                  {syncStatus.comparison.missingCount > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="w-3 h-3" />
                        <span>누락: {syncStatus.comparison.missingCount}개</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 max-h-20 overflow-y-auto">
                        {syncStatus.comparison.missingInDb.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={loadSyncStatus} disabled={loadingStatus} className="w-full">
                  {loadingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Info className="w-4 h-4 mr-2" />}
                  현재 상태 확인
                </Button>
              )}

              {syncResult && (
                <div className={`p-3 rounded-lg text-sm ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {syncResult.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    <span className="font-medium">{syncResult.success ? '동기화 완료' : '동기화 실패'}</span>
                    <span className="text-xs text-muted-foreground">({syncResult.mode === 'safe' ? '신규만' : '전체'})</span>
                  </div>
                  <p className="text-xs">항목: +{syncResult.items.inserted} / 업데이트 {syncResult.items.updated}</p>
                  <p className="text-xs">별칭: +{syncResult.aliases.inserted}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSafeSync} disabled={syncing} size="sm" className="flex-1">
                  {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  신규만 추가
                </Button>
                <AlertDialog open={fullResetDialogOpen} onOpenChange={setFullResetDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={syncing} size="sm" className="flex-1">전체 동기화</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        전체 동기화
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>기존 마스터 표준항목이 코드 데이터로 덮어씌워집니다.</p>
                        <p className="text-amber-600">직접 수정한 항목명, 단위 등이 초기값으로 되돌아갑니다.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={handleFullSync}>전체 동기화 실행</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Excel 관리 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="w-4 h-4" />
                Excel 관리
              </CardTitle>
              <CardDescription className="text-xs">
                마스터 표준항목을 Excel로 내보내거나 가져옵니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {importResult.success && importResult.items.failed === 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="font-medium">{importResult.success ? '가져오기 완료' : '가져오기 실패'}</span>
                  </div>
                  <p className="text-xs">항목: 총 {importResult.items.total}개 중 +{importResult.items.inserted} / 업데이트 {importResult.items.updated}</p>
                  {importResult.errors.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">{importResult.errors[0]}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExcelExport} disabled={excelExporting || excelImporting} size="sm" className="flex-1">
                  {excelExporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  내보내기
                </Button>
                <Button variant="outline" onClick={() => excelFileInputRef.current?.click()} disabled={excelExporting || excelImporting} size="sm" className="flex-1">
                  {excelImporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  가져오기
                </Button>
                <input ref={excelFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
              </div>

              <p className="text-xs text-muted-foreground">
                Excel에서 설명(description)을 편집한 후 가져오기하면 일괄 업데이트됩니다.
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList>
            <TabsTrigger value="items" className="gap-2">
              <Database className="w-4 h-4" />
              표준항목 ({items.length})
            </TabsTrigger>
            <TabsTrigger value="aliases" className="gap-2">
              <Tag className="w-4 h-4" />
              별칭 ({aliases.length})
            </TabsTrigger>
          </TabsList>

          {/* 표준항목 탭 */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>마스터 표준항목</CardTitle>
                    <CardDescription>모든 사용자에게 공통으로 적용되는 표준 검사항목입니다</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    항목 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* 검색 및 필터 */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="항목명 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterExamType} onValueChange={setFilterExamType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="검사 유형" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 유형</SelectItem>
                      {EXAM_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>
                          {type} ({examTypeStats[type] || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* 항목 목록 */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.display_name_ko && (
                            <span className="text-muted-foreground">({item.display_name_ko})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.exam_type || 'N/A'}
                          </Badge>
                          {item.default_unit && (
                            <span className="text-xs text-muted-foreground">{item.default_unit}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingItem({ ...item })
                            setIsEditModalOpen(true)
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>마스터 항목 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{item.name}&quot;을(를) 삭제하시겠습니까?
                                이 항목을 사용하는 검사 기록이 있으면 삭제할 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    검색 결과가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 별칭 탭 */}
          <TabsContent value="aliases">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>마스터 별칭</CardTitle>
                    <CardDescription>OCR에서 인식된 항목명을 표준항목에 매핑하는 별칭입니다</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddAliasModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    별칭 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {aliases.map((alias) => (
                    <div key={alias.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono">{alias.alias}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{alias.canonical_name}</span>
                        </div>
                        {alias.source_hint && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {alias.source_hint}
                          </Badge>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>별칭 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{alias.alias}&quot; 별칭을 삭제하시겠습니까?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAlias(alias.id)}>
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>

                {aliases.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    등록된 별칭이 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 항목 추가 모달 */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>마스터 항목 추가</DialogTitle>
              <DialogDescription>
                새 표준 검사항목을 추가합니다. 모든 사용자에게 적용됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>항목명 (영문) *</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="예: Creatinine"
                />
              </div>

              <div className="space-y-2">
                <Label>한글명</Label>
                <Input
                  value={newItem.display_name_ko}
                  onChange={(e) => setNewItem({ ...newItem, display_name_ko: e.target.value })}
                  placeholder="예: 크레아티닌"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>단위</Label>
                  <Input
                    value={newItem.default_unit}
                    onChange={(e) => setNewItem({ ...newItem, default_unit: e.target.value })}
                    placeholder="예: mg/dL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>검사 유형</Label>
                  <Select
                    value={newItem.exam_type}
                    onValueChange={(v) => setNewItem({ ...newItem, exam_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>장기 태그</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[120px] overflow-y-auto">
                  {ORGAN_TAG_OPTIONS.map(tag => {
                    const isSelected = newItem.organ_tags.includes(tag)
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleOrganTag(
                          tag,
                          newItem.organ_tags,
                          (tags) => setNewItem({ ...newItem, organ_tags: tags })
                        )}
                      >
                        {tag}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>취소</Button>
              <Button onClick={handleAddItem} disabled={saving || !newItem.name.trim()}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                추가
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 항목 편집 모달 */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>마스터 항목 편집</DialogTitle>
              <DialogDescription>변경사항은 모든 사용자에게 적용됩니다.</DialogDescription>
            </DialogHeader>

            {editingItem && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>항목명 (영문)</Label>
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>한글명</Label>
                  <Input
                    value={editingItem.display_name_ko || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, display_name_ko: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>단위</Label>
                    <Input
                      value={editingItem.default_unit || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, default_unit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>검사 유형</Label>
                    <Select
                      value={editingItem.exam_type || ''}
                      onValueChange={(v) => setEditingItem({ ...editingItem, exam_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_TYPE_OPTIONS.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>장기 태그</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[120px] overflow-y-auto">
                    {ORGAN_TAG_OPTIONS.map(tag => {
                      const isSelected = (editingItem.organ_tags || []).includes(tag)
                      return (
                        <Badge
                          key={tag}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleOrganTag(
                            tag,
                            editingItem.organ_tags,
                            (tags) => setEditingItem({ ...editingItem, organ_tags: tags })
                          )}
                        >
                          {tag}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>공통 설명</Label>
                  <Textarea
                    value={editingItem.description_common || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description_common: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-red-600">높을 때 설명</Label>
                  <Textarea
                    value={editingItem.description_high || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description_high: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-600">낮을 때 설명</Label>
                  <Textarea
                    value={editingItem.description_low || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description_low: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>취소</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 별칭 추가 모달 */}
        <Dialog open={isAddAliasModalOpen} onOpenChange={setIsAddAliasModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>마스터 별칭 추가</DialogTitle>
              <DialogDescription>모든 사용자에게 적용됩니다.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>별칭 *</Label>
                <Input
                  value={newAlias.alias}
                  onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
                  placeholder="예: Cre, CREA"
                />
              </div>

              <div className="space-y-2">
                <Label>표준항목명 *</Label>
                <Input
                  value={newAlias.canonical_name}
                  onChange={(e) => setNewAlias({ ...newAlias, canonical_name: e.target.value })}
                  placeholder="예: Creatinine"
                />
              </div>

              <div className="space-y-2">
                <Label>장비 힌트 (선택)</Label>
                <Input
                  value={newAlias.source_hint}
                  onChange={(e) => setNewAlias({ ...newAlias, source_hint: e.target.value })}
                  placeholder="예: IDEXX, ABL80F"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAliasModalOpen(false)}>취소</Button>
              <Button
                onClick={handleAddAlias}
                disabled={savingAlias || !newAlias.alias.trim() || !newAlias.canonical_name.trim()}
              >
                {savingAlias ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                추가
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
