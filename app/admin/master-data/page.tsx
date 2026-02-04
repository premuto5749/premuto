'use client'

import { useState, useEffect } from 'react'
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
  Database, ShieldCheck, ArrowLeft, Upload
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/settings?tab=data">
                        <Upload className="w-4 h-4 mr-1" />
                        Excel 가져오기
                      </Link>
                    </Button>
                    <Button onClick={() => setIsAddModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      항목 추가
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
