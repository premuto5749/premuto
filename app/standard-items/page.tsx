'use client'

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { Loader2, Plus, Pencil, Search, RefreshCw, Database } from 'lucide-react'

interface StandardItem {
  id: string
  name: string
  display_name_ko: string | null
  default_unit: string | null
  category: string | null
  exam_type: string | null
  organ_tags: string[] | null
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
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterExamType, setFilterExamType] = useState<string>('all')

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
    organ_tags: [] as string[]
  })

  useEffect(() => {
    fetchData()
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

  const handleSyncMasterData = async () => {
    if (!confirm('마스터 데이터를 동기화하시겠습니까? 기존 데이터가 업데이트됩니다.')) {
      return
    }

    setSyncing(true)
    try {
      const response = await fetch('/api/admin/sync-master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ migrateOldMappings: false })
      })

      const result = await response.json()

      if (result.success) {
        alert(`동기화 완료!\n- 삽입: ${result.items.inserted}개\n- 업데이트: ${result.items.updated}개\n- 별칭: ${result.aliases.inserted}개`)
        fetchData()
      } else {
        alert(`동기화 실패: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('동기화 중 오류가 발생했습니다.')
    } finally {
      setSyncing(false)
    }
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
          organ_tags: editingItem.organ_tags
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
        organ_tags: []
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

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="표준항목 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="표준항목 관리" />

      <div className="container max-w-7xl mx-auto py-10 px-4">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <div className="text-sm font-medium text-muted-foreground">검사 유형 수</div>
              <div className="text-2xl font-bold text-green-600">{Object.keys(examTypeStats).length}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleSyncMasterData}
                disabled={syncing}
                className="w-full"
                variant="outline"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    동기화 중...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    마스터 데이터 동기화
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">표준 항목 ({items.length})</TabsTrigger>
            <TabsTrigger value="aliases">별칭 ({aliases.length})</TabsTrigger>
          </TabsList>

          {/* 표준 항목 탭 */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>표준 검사 항목</CardTitle>
                    <CardDescription>혈액검사 표준 항목을 관리합니다</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    새 항목 추가
                  </Button>
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

                {/* 항목 테이블 */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">항목명</TableHead>
                        <TableHead className="w-[150px]">한글명</TableHead>
                        <TableHead className="w-[80px]">단위</TableHead>
                        <TableHead className="w-[100px]">검사 유형</TableHead>
                        <TableHead className="w-[250px]">장기 태그</TableHead>
                        <TableHead className="w-[80px]">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.display_name_ko || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{item.default_unit || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.exam_type || item.category || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(item.organ_tags || []).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {(!item.organ_tags || item.organ_tags.length === 0) && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                <CardTitle>항목 별칭</CardTitle>
                <CardDescription>OCR에서 인식된 다양한 이름을 표준 항목에 매핑합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">별칭</TableHead>
                        <TableHead className="w-[200px]">표준 항목</TableHead>
                        <TableHead className="w-[150px]">장비 힌트</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aliases.map((alias) => (
                        <TableRow key={alias.id}>
                          <TableCell className="font-medium">{alias.alias}</TableCell>
                          <TableCell>{alias.canonical_name}</TableCell>
                          <TableCell>
                            {alias.source_hint ? (
                              <Badge variant="secondary">{alias.source_hint}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

        {/* 편집 모달 */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>표준 항목 편집</DialogTitle>
              <DialogDescription>
                항목 정보를 수정합니다
              </DialogDescription>
            </DialogHeader>

            {editingItem && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">항목명 (영문)</label>
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">한글명</label>
                  <Input
                    value={editingItem.display_name_ko || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, display_name_ko: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">단위</label>
                  <Input
                    value={editingItem.default_unit || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, default_unit: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">검사 유형</label>
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
                  <label className="text-sm font-medium">장기 태그</label>
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
              </div>
            )}

            <DialogFooter>
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>새 표준 항목 추가</DialogTitle>
              <DialogDescription>
                새로운 표준 검사 항목을 등록합니다
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">항목명 (영문) *</label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="예: Creatinine"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">한글명</label>
                <Input
                  value={newItem.display_name_ko}
                  onChange={(e) => setNewItem({ ...newItem, display_name_ko: e.target.value })}
                  placeholder="예: 크레아티닌"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">단위</label>
                <Input
                  value={newItem.default_unit}
                  onChange={(e) => setNewItem({ ...newItem, default_unit: e.target.value })}
                  placeholder="예: mg/dL"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">검사 유형</label>
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
                <label className="text-sm font-medium">장기 태그</label>
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
            </div>

            <DialogFooter>
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
