'use client'

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast'

interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  created_at: string
  test_results: Array<{
    id: string
    standard_items: {
      name: string
    }
  }>
}

function RecordsManagementContent() {
  const [records, setRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/test-results')
      const result = await response.json()

      if (result.success && result.data) {
        setRecords(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/test-results?id=${deleteId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: '삭제 완료',
          description: '검사 기록이 삭제되었습니다.'
        })
        fetchRecords()
      } else {
        throw new Error(result.error || '삭제에 실패했습니다')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: '삭제 실패',
        description: error instanceof Error ? error.message : '삭제에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="검사 기록 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="검사 기록 관리" />

      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>저장된 검사 기록 ({records.length}개)</CardTitle>
            <CardDescription>
              검사 기록을 삭제하면 해당 날짜의 모든 검사 결과가 함께 삭제됩니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                저장된 검사 기록이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>검사일</TableHead>
                      <TableHead>병원</TableHead>
                      <TableHead className="text-center">항목 수</TableHead>
                      <TableHead className="text-right">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {formatDate(record.test_date)}
                        </TableCell>
                        <TableCell>
                          {record.hospital_name || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {record.test_results?.length || 0}개
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(record.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">💡 팁</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>검사 기록을 삭제하면 해당 날짜의 모든 검사 항목과 결과가 함께 삭제됩니다</li>
            <li>삭제된 데이터는 복구할 수 없으니 신중하게 결정하세요</li>
            <li>잘못 입력된 데이터가 있다면 삭제 후 다시 업로드하세요</li>
          </ul>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검사 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 검사 기록과 관련된 모든 검사 결과가 삭제됩니다. 삭제된 데이터는 복구할 수 없습니다.
              <br />
              정말로 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function RecordsManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <RecordsManagementContent />
    </Suspense>
  )
}
