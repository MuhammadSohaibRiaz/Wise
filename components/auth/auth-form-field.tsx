"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthFormFieldProps {
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}

export function AuthFormField({
  label,
  type,
  placeholder,
  value,
  onChange,
  error,
  required = true,
}: AuthFormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={error ? "border-red-500" : ""}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
