"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileIcon, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface UploadZoneProps {
  caseId?: string | null
  onUploadComplete: (documentId: string) => void
  onUploadError: (message: string) => void
}

export function UploadZone({ caseId, onUploadComplete, onUploadError }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setStatus("idle")
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg", ".jgp"],
      "image/png": [".png"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const uploadFile = async () => {
    if (!file) return

    try {
      setUploading(true)
      setStatus("uploading")
      setProgress(10)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error("Not authenticated")

      // 1. Upload to Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random()}.${fileExt}`
      const folder = caseId || user.id
      const filePath = `${folder}/${fileName}`

      const { error: storageError, data: storageData } = await supabase.storage
        .from("documents")
        .upload(filePath, file)

      if (storageError) throw storageError
      setProgress(50)

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath)

      // 3. Create Database Record (case_id is nullable for standalone analysis docs)
      const docRow: Record<string, unknown> = {
        uploaded_by: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        status: "pending",
      }
      if (caseId) docRow.case_id = caseId

      const { data: docData, error: dbError } = await supabase
        .from("documents")
        .insert(docRow)
        .select()
        .single()

      if (dbError) throw dbError

      setProgress(100)
      setStatus("success")
      onUploadComplete(docData.id)
      
    } catch (error: any) {
      console.error("Upload error:", error)
      setStatus("error")
      onUploadError(error.message || "Failed to upload document")
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setStatus("idle")
    setProgress(0)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out cursor-pointer",
          isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/20 hover:border-primary/50",
          uploading && "opacity-60 cursor-not-allowed",
          status === "success" && "border-green-500 bg-green-50/50",
          status === "error" && "border-destructive bg-destructive/5"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={cn(
            "p-4 rounded-full bg-primary/10 text-primary transition-transform duration-300",
            status === "success" && "bg-green-100 text-green-600",
            status === "error" && "bg-red-100 text-red-600"
          )}>
            {status === "success" ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : status === "error" ? (
              <AlertCircle className="h-8 w-8" />
            ) : (
              <Upload className={cn("h-8 w-8", uploading && "animate-bounce")} />
            )}
          </div>

          {file ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground max-w-[240px] truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold text-lg">Drop your legal document here</p>
              <p className="text-sm text-muted-foreground">
                Support for PDF, Images (JPG/PNG), or Word Documents (Max 10MB)
              </p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 p-4 pt-0">
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {file && status !== "success" && !uploading && (
          <>
            <Button onClick={uploadFile} className="flex-1 gap-2">
              Start Analysis
            </Button>
            <Button variant="outline" size="icon" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {status === "success" && (
          <Button variant="outline" className="w-full gap-2" onClick={reset}>
            Upload Another
          </Button>
        )}
      </div>
    </div>
  )
}
