"use client"

import { useState } from "react"
import { Download, Loader2, Paperclip } from "lucide-react"
import {
  attachmentDownloadHref,
  parseMessageAttachment,
  type MessageAttachmentMeta,
} from "@/lib/chat/message-attachment"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface MessageContentProps {
  content: string
  caseId: string
  isOwnMessage: boolean
}

function AttachmentCard({
  caseId,
  meta,
  legacyUrl,
  isOwnMessage,
}: {
  caseId: string
  meta: MessageAttachmentMeta
  legacyUrl?: string
  isOwnMessage: boolean
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const href = attachmentDownloadHref(caseId, meta, legacyUrl)
  const canDownload = Boolean(meta.path || legacyUrl)

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canDownload || isDownloading) return

    setIsDownloading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) {
        throw new Error("Download failed")
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = meta.name
      anchor.rel = "noopener"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(href, "_blank", "noopener,noreferrer")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3",
          isOwnMessage
            ? "border-primary-foreground/25 bg-primary-foreground/10"
            : "border-border/60 bg-background/50",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isOwnMessage ? "bg-primary-foreground/15" : "bg-primary/10",
          )}
        >
          <Paperclip className={cn("h-5 w-5", isOwnMessage ? "text-primary-foreground" : "text-primary")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{meta.name}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={!canDownload || isDownloading}
            className={cn(
              "h-auto p-0 text-xs font-medium",
              isOwnMessage ? "text-primary-foreground/90" : "text-primary",
            )}
            onClick={handleDownload}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <Download className="mr-1 h-3.5 w-3.5" />
                Download file
              </>
            )}
          </Button>
        </span>
      </div>
      {meta.caption ? (
        <p
          className={cn(
            "whitespace-pre-wrap text-[15px] font-medium leading-relaxed",
            isOwnMessage ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {meta.caption}
        </p>
      ) : null}
    </div>
  )
}

export function MessageContent({ content, caseId, isOwnMessage }: MessageContentProps) {
  const parsed = parseMessageAttachment(content)

  if (parsed.kind === "attachment") {
    return (
      <AttachmentCard
        caseId={caseId}
        meta={parsed.meta}
        legacyUrl={parsed.legacyUrl}
        isOwnMessage={isOwnMessage}
      />
    )
  }

  return (
    <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
      {parsed.text}
    </p>
  )
}
