"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Hospital } from "@/types"

interface HospitalSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  hospitals: Hospital[]
  onHospitalCreated: (hospital: Hospital) => void
}

export function HospitalSelector({
  value,
  onValueChange,
  hospitals,
  onHospitalCreated
}: HospitalSelectorProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newHospitalName, setNewHospitalName] = React.useState("")
  const [newHospitalAddress, setNewHospitalAddress] = React.useState("")
  const [newHospitalPhone, setNewHospitalPhone] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  // 현재 선택된 병원이 목록에 있는지 확인
  const selectedHospital = hospitals.find(h => h.name === value)
  // OCR에서 추출한 병원명이 DB에 없는 경우를 위한 표시값
  const displayValue = selectedHospital ? value : undefined

  const handleCreateHospital = async () => {
    if (!newHospitalName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHospitalName.trim(),
          address: newHospitalAddress.trim() || null,
          phone: newHospitalPhone.trim() || null
        })
      })

      const result = await response.json()

      if (response.ok && result.data) {
        onHospitalCreated(result.data)
        onValueChange(result.data.name)
        setDialogOpen(false)
        setNewHospitalName("")
        setNewHospitalAddress("")
        setNewHospitalPhone("")
      } else {
        alert(result.error || '병원 추가에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to create hospital:', error)
      alert('병원 추가 중 오류가 발생했습니다')
    } finally {
      setCreating(false)
    }
  }

  // 새 병원 추가 다이얼로그 열 때 OCR 값으로 미리 채우기
  const openNewHospitalDialog = () => {
    // value가 있지만 목록에 없으면 (OCR 추출값) 해당 값으로 미리 채움
    if (value && !selectedHospital && value !== 'Unknown') {
      setNewHospitalName(value)
    }
    setDialogOpen(true)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={displayValue} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={value && !selectedHospital ? `${value} (미등록)` : "병원 선택..."} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
            {hospitals.length === 0 ? (
              <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                등록된 병원이 없습니다
              </div>
            ) : (
              hospitals.map((hospital) => (
                <SelectItem key={hospital.id} value={hospital.name}>
                  <div className="flex flex-col items-start">
                    <span>{hospital.name}</span>
                    {hospital.address && (
                      <span className="text-xs text-muted-foreground">
                        {hospital.address}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={openNewHospitalDialog}
          title="새 병원 추가"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 미등록 병원명 표시 */}
      {value && !selectedHospital && value !== 'Unknown' && (
        <p className="text-xs text-amber-600">
          &quot;{value}&quot;은(는) 미등록 병원입니다. 목록에서 선택하거나 새로 추가해주세요.
        </p>
      )}
      {value === 'Unknown' && (
        <p className="text-xs text-amber-600">
          병원명이 인식되지 않았습니다. 병원을 선택해주세요.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 병원 추가</DialogTitle>
            <DialogDescription>
              병원 정보를 입력하세요. 이름만 필수이며 나머지는 선택사항입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hospital-name">병원명 *</Label>
              <Input
                id="hospital-name"
                value={newHospitalName}
                onChange={(e) => setNewHospitalName(e.target.value)}
                placeholder="예: 타임즈동물의료센터"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital-address">주소</Label>
              <Input
                id="hospital-address"
                value={newHospitalAddress}
                onChange={(e) => setNewHospitalAddress(e.target.value)}
                placeholder="예: 서울특별시 강남구..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital-phone">전화번호</Label>
              <Input
                id="hospital-phone"
                value={newHospitalPhone}
                onChange={(e) => setNewHospitalPhone(e.target.value)}
                placeholder="예: 02-1234-5678"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              취소
            </Button>
            <Button
              onClick={handleCreateHospital}
              disabled={!newHospitalName.trim() || creating}
            >
              {creating ? "추가 중..." : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
