"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  const [open, setOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newHospitalName, setNewHospitalName] = React.useState("")
  const [newHospitalAddress, setNewHospitalAddress] = React.useState("")
  const [newHospitalPhone, setNewHospitalPhone] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const selectedHospital = hospitals.find(h => h.name === value)
  // OCR에서 추출한 병원명이 DB에 없는 경우 표시용
  const displayValue = value && !selectedHospital ? value : selectedHospital?.name

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

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {displayValue || "병원 선택..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="병원 검색..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    병원을 찾을 수 없습니다
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpen(false)
                      setDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    새 병원 추가
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {hospitals.map((hospital) => (
                  <CommandItem
                    key={hospital.id}
                    value={hospital.name}
                    onSelect={() => {
                      // cmdk lowercases values in onSelect, so use hospital.name directly
                      onValueChange(hospital.name === value ? "" : hospital.name)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === hospital.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{hospital.name}</div>
                      {hospital.address && (
                        <div className="text-xs text-muted-foreground">
                          {hospital.address}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  새 병원 추가
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
    </>
  )
}
