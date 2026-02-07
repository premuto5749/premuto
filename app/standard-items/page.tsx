'use client'

import { useState, useEffect, Suspense } from 'react'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Progress } from '@/components/ui/progress'
import { Loader2, Plus, Pencil, Search, RefreshCw, ChevronDown, ChevronRight, Trash2, Tag, FileText, Info, Sparkles, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  // 사용자 오버라이드 관련
  is_custom?: boolean    // 사용자가 새로 추가한 항목
  is_modified?: boolean  // 마스터를 수정한 항목
}

interface ItemAlias {
  id: string
  alias: string
  canonical_name: string
  source_hint: string | null
  standard_item_id: string
}

// 검사 유형 옵션
const EXAM_TYPE_OPTIONS = [
  'Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas',
  'Coagulation', '뇨검사', '안과검사', 'Echo'
]

// 장기 태그 옵션
const ORGAN_TAG_OPTIONS = [
  '기본신체', '혈액', '간', '신장', '췌장', '심장', '전해질', '산염기',
  '호흡', '지혈', '면역', '염증', '대사', '내분비', '근육', '뼈',
  '담도', '영양', '알레르기', '감염', '안과'
]

function StandardItemsContent() {
  const [items, setItems] = useState<StandardItem[]>([])
  const [aliases, setAliases] = useState<ItemAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterExamType, setFilterExamType] = useState<string>('all')

  // 확장된 아이템 상태
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // 편집 모달 상태
  const [editingItem, setEditingItem] = useState<StandardItem | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // 신규 항목 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
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

  // 별칭 추가 모달 상태
  const [isAddAliasModalOpen, setIsAddAliasModalOpen] = useState(false)
  const [aliasTargetItem, setAliasTargetItem] = useState<StandardItem | null>(null)
  const [newAlias, setNewAlias] = useState({ alias: '', source_hint: '' })
  const [savingAlias, setSavingAlias] = useState(false)

  // AI 설명 생성 상태
  const [tierInfo, setTierInfo] = useState<{ tier: string; limit: number } | null>(null)
  const [isGenConfirmOpen, setIsGenConfirmOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ completed: 0, total: 0 })
  const [genResult, setGenResult] = useState<{ generated: number; failed: number } | null>(null)
  const [isGenResultOpen, setIsGenResultOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
    fetchTierInfo()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Standard items 조회
      const itemsResponse = await fetch('/api/standard-items')
      const itemsData = await itemsResponse.json()
      setItems(itemsData.data || [])

      // Aliases 조회
      const aliasesResponse = await fetch('/api/item-aliases')
      const aliasesData = await aliasesResponse.json()
      setAliases(aliasesData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTierInfo = async () => {
    try {
      const res = await fetch('/api/tier')
      const data = await res.json()
      if (data.success) {
        setTierInfo({
          tier: data.data.tier,
          limit: data.data.config.daily_description_gen_limit ?? 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch tier info:', error)
    }
  }

  // 설명 없는 항목 목록
  const itemsWithoutDescription = items.filter(
    item => !item.description_common && !item.description_high && !item.description_low
  )

  const handleGenerateDescriptions = async () => {
    setIsGenConfirmOpen(false)
    setIsGenerating(true)

    const targetItems = itemsWithoutDescription
    const total = targetItems.length
    setGenProgress({ completed: 0, total })

    let totalGenerated = 0
    let totalFailed = 0
    const BATCH_SIZE = 10

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = targetItems.slice(i, i + BATCH_SIZE)
      const batchIds = batch.map(item => item.id)

      try {
        const res = await fetch('/api/generate-descriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: batchIds }),
        })

        if (res.status === 403) {
          const data = await res.json()
          toast({
            title: '한도 도달',
            description: data.message || '오늘의 AI 설명 생성 한도에 도달했습니다',
            variant: 'destructive',
          })
          totalFailed += total - i
          break
        }

        if (res.status === 429) {
          toast({
            title: 'AI 사용량 제한',
            description: '잠시 후 다시 시도해주세요',
            variant: 'destructive',
          })
          totalFailed += total - i
          break
        }

        if (!res.ok) {
          totalFailed += batch.length
        } else {
          const data = await res.json()
          totalGenerated += data.generated || 0
          totalFailed += data.failed || 0
        }
      } catch {
        totalFailed += batch.length
      }

      setGenProgress({ completed: Math.min(i + BATCH_SIZE, total), total })
    }

    setIsGenerating(false)
    setGenResult({ generated: totalGenerated, failed: totalFailed })
    setIsGenResultOpen(true)
    fetchData()
    fetchTierInfo()
  }

  const handleEditItem = (item: StandardItem) => {
    setEditingItem({ ...item })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    setSaving(true)
    try {
      const response = await fetch(`/api/standard-items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingItem.name,
          display_name_ko: editingItem.display_name_ko,
          default_unit: editingItem.default_unit,
          exam_type: editingItem.exam_type,
          organ_tags: editingItem.organ_tags,
          description_common: editingItem.description_common,
          description_high: editingItem.description_high,
          description_low: editingItem.description_low,
        })
      })

      if (!response.ok) {
        throw new Error('저장에 실패했습니다.')
      }

      setIsEditModalOpen(false)
      setEditingItem(null)
      fetchData()
    } catch (error) {
      console.error('Save error:', error)
      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      alert('항목명을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/standard-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '추가에 실패했습니다.')
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
      console.error('Add error:', error)
      alert(error instanceof Error ? error.message : '추가 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
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

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  // 별칭 관련 함수
  const openAddAliasModal = (item: StandardItem) => {
    setAliasTargetItem(item)
    setNewAlias({ alias: '', source_hint: '' })
    setIsAddAliasModalOpen(true)
  }

  const handleAddAlias = async () => {
    if (!aliasTargetItem || !newAlias.alias.trim()) return

    setSavingAlias(true)
    try {
      const response = await fetch('/api/item-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: newAlias.alias.trim(),
          canonical_name: aliasTargetItem.name,
          source_hint: newAlias.source_hint.trim() || null,
          standard_item_id: aliasTargetItem.id,
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '별칭 추가에 실패했습니다.')
      }

      setIsAddAliasModalOpen(false)
      setAliasTargetItem(null)
      setNewAlias({ alias: '', source_hint: '' })
      fetchData()
    } catch (error) {
      console.error('Add alias error:', error)
      alert(error instanceof Error ? error.message : '별칭 추가 중 오류가 발생했습니다.')
    } finally {
      setSavingAlias(false)
    }
  }

  const handleDeleteAlias = async (aliasId: string) => {
    try {
      const response = await fetch(`/api/item-aliases?id=${aliasId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.')
      }

      fetchData()
    } catch (error) {
      console.error('Delete alias error:', error)
      alert('별칭 삭제 중 오류가 발생했습니다.')
    }
  }

  // 필터링된 항목
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.display_name_ko && item.display_name_ko.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesExamType = filterExamType === 'all' ||
      item.exam_type === filterExamType ||
      item.category === filterExamType

    return matchesSearch && matchesExamType
  })

  // 검사 유형별 통계
  const examTypeStats: Record<string, number> = {}
  items.forEach(item => {
    const type = item.exam_type || item.category || 'Other'
    examTypeStats[type] = (examTypeStats[type] || 0) + 1
  })

  // 커스텀/수정된 항목 통계
  const customItemsCount = items.filter(item => item.is_custom).length
  const modifiedItemsCount = items.filter(item => item.is_modified).length

  // 항목별 별칭 맵
  const aliasesByItemId = aliases.reduce((acc, alias) => {
    if (!acc[alias.standard_item_id]) {
      acc[alias.standard_item_id] = []
    }
    acc[alias.standard_item_id].push(alias)
    return acc
  }, {} as Record<string, ItemAlias[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="내 검사항목" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="내 검사항목" />

      <div className="container max-w-7xl mx-auto py-10 px-4">
        {/* 안내 배너 */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800">나만의 검사항목 관리</p>
            <p className="text-blue-700 mt-1">
              기본 마스터 데이터에 내가 추가하거나 수정한 항목을 관리합니다.
              여기서 변경한 내용은 나에게만 적용됩니다.
            </p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">전체 표준 항목</div>
              <div className="text-2xl font-bold">{items.length}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">등록된 별칭</div>
              <div className="text-2xl font-bold text-blue-600">{aliases.length}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">내 커스텀 항목</div>
              <div className="text-2xl font-bold text-green-600">{customItemsCount}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">수정한 항목</div>
              <div className="text-2xl font-bold text-amber-600">{modifiedItemsCount}개</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>내 검사항목 목록</CardTitle>
                <CardDescription>마스터 데이터 + 내가 추가/수정한 항목이 표시됩니다</CardDescription>
              </div>
              <div className="flex gap-2">
                {tierInfo && tierInfo.limit === 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => toast({
                      title: '업그레이드 필요',
                      description: 'Basic 요금제부터 이용 가능합니다',
                      variant: 'destructive',
                    })}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    AI 설명 생성
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsGenConfirmOpen(true)}
                    disabled={itemsWithoutDescription.length === 0}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 설명 생성
                    {itemsWithoutDescription.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{itemsWithoutDescription.length}</Badge>
                    )}
                  </Button>
                )}
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  내 항목 추가
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 검색 및 필터 */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="항목명 또는 한글명 검색..."
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

            {/* 항목 리스트 (Collapsible) */}
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const itemAliases = aliasesByItemId[item.id] || []
                const isExpanded = expandedItems.has(item.id)
                const hasDescription = item.description_common || item.description_high || item.description_low

                return (
                  <Collapsible key={item.id} open={isExpanded} onOpenChange={() => toggleExpanded(item.id)}>
                    <div className="border rounded-lg">
                      {/* 헤더 */}
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.name}</span>
                                {item.display_name_ko && (
                                  <span className="text-muted-foreground">({item.display_name_ko})</span>
                                )}
                                {item.is_custom && (
                                  <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">내 항목</Badge>
                                )}
                                {item.is_modified && (
                                  <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">수정됨</Badge>
                                )}
                                {hasDescription && (
                                  <span title="설명 있음">
                                    <FileText className="w-3 h-3 text-blue-500" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.exam_type || item.category || 'N/A'}
                                </Badge>
                                {item.default_unit && (
                                  <span className="text-xs text-muted-foreground">{item.default_unit}</span>
                                )}
                                {itemAliases.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Tag className="w-3 h-3 mr-1" />
                                    별칭 {itemAliases.length}개
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditItem(item)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </CollapsibleTrigger>

                      {/* 확장 내용 */}
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 bg-muted/30 space-y-4">
                          {/* 장기 태그 */}
                          {item.organ_tags && item.organ_tags.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">장기 태그</div>
                              <div className="flex flex-wrap gap-1">
                                {item.organ_tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 설명 */}
                          {hasDescription && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">설명</div>
                              {item.description_common && (
                                <div className="text-sm p-2 bg-background rounded">
                                  <span className="font-medium">공통:</span> {item.description_common}
                                </div>
                              )}
                              {item.description_high && (
                                <div className="text-sm p-2 bg-red-50 rounded text-red-800">
                                  <span className="font-medium">🔴 높을 때:</span> {item.description_high}
                                </div>
                              )}
                              {item.description_low && (
                                <div className="text-sm p-2 bg-blue-50 rounded text-blue-800">
                                  <span className="font-medium">🔵 낮을 때:</span> {item.description_low}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 별칭 목록 */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-medium text-muted-foreground">별칭 목록</div>
                              <Button variant="outline" size="sm" onClick={() => openAddAliasModal(item)}>
                                <Plus className="w-3 h-3 mr-1" />
                                별칭 추가
                              </Button>
                            </div>
                            {itemAliases.length > 0 ? (
                              <div className="space-y-1">
                                {itemAliases.map(alias => (
                                  <div key={alias.id} className="flex items-center justify-between p-2 bg-background rounded">
                                    <div className="flex items-center gap-2">
                                      <Tag className="w-3 h-3 text-muted-foreground" />
                                      <span className="font-mono text-sm">{alias.alias}</span>
                                      {alias.source_hint && (
                                        <Badge variant="secondary" className="text-xs">{alias.source_hint}</Badge>
                                      )}
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <Trash2 className="w-3 h-3 text-destructive" />
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
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">등록된 별칭이 없습니다</p>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                검색 결과가 없습니다
              </div>
            )}
          </CardContent>
        </Card>

        {/* 편집 모달 */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>항목 편집</DialogTitle>
              <DialogDescription>
                항목 정보와 설명을 수정합니다
              </DialogDescription>
            </DialogHeader>

            {editingItem && (
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">기본 정보</TabsTrigger>
                  <TabsTrigger value="description">설명</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 pt-4">
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
                        <SelectValue placeholder="검사 유형 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_TYPE_OPTIONS.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>장기 태그</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto">
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
                </TabsContent>

                <TabsContent value="description" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>공통 설명</Label>
                    <Textarea
                      value={editingItem.description_common || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description_common: e.target.value })}
                      placeholder="이 검사 항목에 대한 일반적인 설명"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-red-600">🔴 수치가 높을 때</Label>
                    <Textarea
                      value={editingItem.description_high || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description_high: e.target.value })}
                      placeholder="높은 수치의 의미, 가능한 원인"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-600">🔵 수치가 낮을 때</Label>
                    <Textarea
                      value={editingItem.description_low || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description_low: e.target.value })}
                      placeholder="낮은 수치의 의미, 가능한 원인"
                      rows={3}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '저장'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 신규 항목 추가 모달 */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>내 항목 추가</DialogTitle>
              <DialogDescription>
                나만 사용할 검사 항목을 추가합니다
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">기본 정보</TabsTrigger>
                <TabsTrigger value="description">설명</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
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
                      <SelectValue placeholder="검사 유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>장기 태그</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto">
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
              </TabsContent>

              <TabsContent value="description" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>공통 설명</Label>
                  <Textarea
                    value={newItem.description_common}
                    onChange={(e) => setNewItem({ ...newItem, description_common: e.target.value })}
                    placeholder="이 검사 항목에 대한 일반적인 설명"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-red-600">🔴 수치가 높을 때</Label>
                  <Textarea
                    value={newItem.description_high}
                    onChange={(e) => setNewItem({ ...newItem, description_high: e.target.value })}
                    placeholder="높은 수치의 의미, 가능한 원인"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-600">🔵 수치가 낮을 때</Label>
                  <Textarea
                    value={newItem.description_low}
                    onChange={(e) => setNewItem({ ...newItem, description_low: e.target.value })}
                    placeholder="낮은 수치의 의미, 가능한 원인"
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleAddItem} disabled={saving || !newItem.name.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    추가 중...
                  </>
                ) : (
                  '추가'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 별칭 추가 모달 */}
        <Dialog open={isAddAliasModalOpen} onOpenChange={setIsAddAliasModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>별칭 추가</DialogTitle>
              <DialogDescription>
                {aliasTargetItem?.name} ({aliasTargetItem?.display_name_ko})에 별칭을 추가합니다
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>별칭 *</Label>
                <Input
                  value={newAlias.alias}
                  onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
                  placeholder="예: Cre, CREA, Creat."
                />
              </div>

              <div className="space-y-2">
                <Label>장비 힌트 (선택)</Label>
                <Input
                  value={newAlias.source_hint}
                  onChange={(e) => setNewAlias({ ...newAlias, source_hint: e.target.value })}
                  placeholder="예: IDEXX, ABL80F"
                />
                <p className="text-xs text-muted-foreground">
                  특정 장비에서만 사용되는 별칭인 경우 입력하세요
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAliasModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleAddAlias} disabled={savingAlias || !newAlias.alias.trim()}>
                {savingAlias ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    추가 중...
                  </>
                ) : (
                  '추가'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI 설명 생성 확인 다이얼로그 */}
        <AlertDialog open={isGenConfirmOpen} onOpenChange={setIsGenConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>AI 설명 생성</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>설명이 없는 <strong>{itemsWithoutDescription.length}개</strong> 항목에 대해 AI가 설명을 생성합니다.</p>
                  <p className="text-xs text-muted-foreground">생성된 설명은 수정 가능하며, 나에게만 적용됩니다.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerateDescriptions}>
                <Sparkles className="w-4 h-4 mr-2" />
                생성 시작
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AI 설명 생성 진행 다이얼로그 */}
        <Dialog open={isGenerating} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>AI 설명 생성 중</DialogTitle>
              <DialogDescription>
                잠시만 기다려주세요...
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Progress value={genProgress.total > 0 ? (genProgress.completed / genProgress.total) * 100 : 0} />
              <p className="text-sm text-center text-muted-foreground">
                {genProgress.completed}/{genProgress.total}개 처리 중...
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI 설명 생성 완료 다이얼로그 */}
        <Dialog open={isGenResultOpen} onOpenChange={setIsGenResultOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>생성 완료</DialogTitle>
              <DialogDescription>
                AI 설명 생성이 완료되었습니다.
              </DialogDescription>
            </DialogHeader>
            {genResult && (
              <div className="space-y-2 py-4">
                <p className="text-sm">
                  <span className="font-medium text-green-600">{genResult.generated}개</span> 항목 설명 생성 완료
                </p>
                {genResult.failed > 0 && (
                  <p className="text-sm">
                    <span className="font-medium text-red-600">{genResult.failed}개</span> 실패
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsGenResultOpen(false)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function StandardItemsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <StandardItemsContent />
    </Suspense>
  )
}
