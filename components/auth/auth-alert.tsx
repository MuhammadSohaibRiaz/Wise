"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Info, XCircle } from "lucide-react"

interface AuthAlertProps {
  type: "success" | "error" | "warning" | "info"
  message: string
  onClose?: () => void
}

export function AuthAlert({ type, message, onClose }: AuthAlertProps) {
  const styles = {
    success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: CheckCircle },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: XCircle },
    warning: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", icon: AlertCircle },
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: Info },
  }

  const { bg, border, text, icon: Icon } = styles[type]

  return (
    <Alert className={`${bg} ${border} ${text}`}>
      <Icon className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
