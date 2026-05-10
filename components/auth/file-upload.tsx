"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, X } from "lucide-react"
import Image from "next/image"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number // in MB
  preview?: boolean
  currentImageUrl?: string
  label?: string
}

export function FileUpload({
  onFileSelect,
  accept = "image/*,.pdf,.doc,.docx",
  maxSize = 10,
  preview = true,
  currentImageUrl,
  label = "Click to upload file",
}: FileUploadProps) {
  const isImageUrl = (url: string) => /\.(png|jpe?g|jgp|gif|webp|bmp|svg)(\?.*)?$/i.test(url)

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl && isImageUrl(currentImageUrl) ? currentImageUrl : null,
  )
  const [fileName, setFileName] = useState<string | null>(
    currentImageUrl && !isImageUrl(currentImageUrl) ? "Current document uploaded" : null,
  )
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileName(file.name)

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`)
      return
    }

    // Create preview for images
    if (preview && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }

    onFileSelect(file)
  }

  const handleClear = () => {
    setPreviewUrl(null)
    setFileName(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-accent transition-colors"
      >
        <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />

        {previewUrl ? (
          <div className="relative w-32 h-32 mx-auto">
            <Image src={previewUrl || "/placeholder.svg"} alt="Preview" fill className="object-cover rounded" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary truncate max-w-xs">{fileName}</p>
            {currentImageUrl && (
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View current file
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="text-xs text-destructive hover:underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">Images, PDF, or Word up to {maxSize}MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
