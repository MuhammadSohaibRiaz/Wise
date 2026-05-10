"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { citiesPK } from "@/data/cities-pk"

export function CityOnlineSelect({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange?.(v)}>
      <SelectTrigger className="w-full md:w-64">
        <SelectValue placeholder="Choose city or Online" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="online">Online</SelectItem>
        {citiesPK.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
