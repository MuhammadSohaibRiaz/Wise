"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Brain, Check, FileText, Loader2, MessageSquare, Pencil, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { appendCaseTimelineEvent, CaseTimelineEventType } from "@/lib/case-timeline"

type CaseStatus = "open" | "in_progress" | "pending_completion" | "completed" | "closed"

export interface CaseDocumentItem {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  document_type: string | null
  status: string
  created_at: string
  uploaded_by: string
  document_analysis?: { id: string; analysis_status?: string }[] | null
  uploader?: {
    first_name: string | null
    last_name: string | null
    user_type: string | null
  } | null
}

interface CaseDocumentsPanelProps {
  caseId: string
  caseStatus: CaseStatus
  documents: CaseDocumentItem[]
  currentUserId: string | null
  onUploaded: () => void | Promise<void>
  onFetchAnalysis?: (analysisId: string) => void
  isAnalysisLoading?: boolean
}

interface DocumentComment {
  id: string
  document_id: string
  user_id: string
  comment: string
  created_at: string
  commenter?: {
    first_name: string | null
    last_name: string | null
    user_type: string | null
  } | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
}

function profileName(profile: CaseDocumentItem["uploader"], fallback = "Unknown") {
  if (!profile) return fallback
  return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || fallback
}

export function CaseDocumentsPanel({
  caseId,
  caseStatus,
  documents,
  currentUserId,
  onUploaded,
  onFetchAnalysis,
  isAnalysisLoading = false,
}: CaseDocumentsPanelProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, DocumentComment[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [fileNameDrafts, setFileNameDrafts] = useState<Record<string, string>>({})
  const [fileNameOverrides, setFileNameOverrides] = useState<Record<string, string>>({})
  const [editingFileNameId, setEditingFileNameId] = useState<string | null>(null)
  const [isSavingDocMeta, setIsSavingDocMeta] = useState<string | null>(null)
  const [docMetaAvailable, setDocMetaAvailable] = useState(true)

  const canUpload = caseStatus !== "completed" && caseStatus !== "closed"
  const documentIds = useMemo(() => documents.map((doc) => doc.id), [documents])

  const fetchDocumentMeta = useCallback(async () => {
    if (!currentUserId || documentIds.length === 0) {
      setNotes({})
      setNoteDrafts({})
      setComments({})
      return
    }

    const supabase = createClient()
    const [notesResult, commentsResult] = await Promise.all([
      supabase
        .from("case_document_notes")
        .select("document_id, note")
        .in("document_id", documentIds),
      supabase
        .from("case_document_comments")
        .select(`
          id,
          document_id,
          user_id,
          comment,
          created_at,
          commenter:profiles!case_document_comments_user_id_fkey (
            first_name,
            last_name,
            user_type
          )
        `)
        .in("document_id", documentIds)
        .order("created_at", { ascending: true }),
    ])

    if (notesResult.error || commentsResult.error) {
      const message = notesResult.error?.message || commentsResult.error?.message || ""
      if (message.includes("case_document_") || message.includes("does not exist")) {
        setDocMetaAvailable(false)
      }
      return
    }

    setDocMetaAvailable(true)

    const nextNotes: Record<string, string> = {}
    for (const row of notesResult.data || []) {
      nextNotes[row.document_id] = row.note || ""
    }
    setNotes(nextNotes)
    setNoteDrafts(nextNotes)

    const nextComments: Record<string, DocumentComment[]> = {}
    for (const row of (commentsResult.data || []) as DocumentComment[]) {
      nextComments[row.document_id] = [...(nextComments[row.document_id] || []), row]
    }
    setComments(nextComments)
  }, [currentUserId, documentIds])

  useEffect(() => {
    void fetchDocumentMeta()
  }, [fetchDocumentMeta])

  useEffect(() => {
    if (!currentUserId || !docMetaAvailable || documentIds.length === 0) return

    const supabase = createClient()
    const documentIdSet = new Set(documentIds)
    const channel = supabase
      .channel(`case-document-comments-${caseId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_document_comments" },
        (payload) => {
          const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as { document_id?: string } | null
          if (row?.document_id && documentIdSet.has(row.document_id)) {
            void fetchDocumentMeta()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [caseId, currentUserId, docMetaAvailable, documentIds, fetchDocumentMeta])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !currentUserId) return

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please upload a file up to 10MB.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      const supabase = createClient()
      const ext = file.name.split(".").pop() || "file"
      const path = `${caseId}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(path)

      const { data: document, error: insertError } = await supabase
        .from("documents")
        .insert({
          case_id: caseId,
          uploaded_by: currentUserId,
          file_name: safeFileName(file.name),
          file_url: publicUrl,
          file_type: file.type || null,
          file_size: file.size,
          document_type: "case_document",
          status: "pending",
        })
        .select("id")
        .single()

      if (insertError) throw insertError

      await appendCaseTimelineEvent(supabase, {
        caseId,
        actorId: currentUserId,
        eventType: CaseTimelineEventType.DOCUMENT_UPLOADED,
        metadata: { document_id: document.id, file_name: file.name, source: "case_documents_tab" },
      })

      toast({
        title: "Document uploaded",
        description: "The document is now visible in this case workspace.",
      })
      await onUploaded()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload document."
      toast({ title: "Upload failed", description: message, variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const saveNote = async (documentId: string) => {
    if (!currentUserId || !docMetaAvailable) return
    const note = (noteDrafts[documentId] || "").trim()
    try {
      setIsSavingDocMeta(documentId)
      const supabase = createClient()
      const { error } = await supabase.from("case_document_notes").upsert(
        {
          document_id: documentId,
          user_id: currentUserId,
          note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_id,user_id" },
      )
      if (error) throw error
      setNotes((prev) => ({ ...prev, [documentId]: note }))
      toast({ title: "Note saved" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save note."
      toast({ title: "Note unavailable", description: message, variant: "destructive" })
    } finally {
      setIsSavingDocMeta(null)
    }
  }

  const addComment = async (documentId: string) => {
    if (!currentUserId || !docMetaAvailable) return
    const comment = (commentDrafts[documentId] || "").trim()
    if (comment.length < 2) return

    try {
      setIsSavingDocMeta(documentId)
      const supabase = createClient()
      const { error } = await supabase.from("case_document_comments").insert({
        document_id: documentId,
        user_id: currentUserId,
        comment,
      })
      if (error) throw error
      setCommentDrafts((prev) => ({ ...prev, [documentId]: "" }))
      const { data } = await supabase
        .from("case_document_comments")
        .select(`
          id,
          document_id,
          user_id,
          comment,
          created_at,
          commenter:profiles!case_document_comments_user_id_fkey (
            first_name,
            last_name,
            user_type
          )
        `)
        .eq("document_id", documentId)
        .order("created_at", { ascending: true })
      setComments((prev) => ({ ...prev, [documentId]: (data || []) as DocumentComment[] }))
      toast({ title: "Comment added" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add comment."
      toast({ title: "Comment unavailable", description: message, variant: "destructive" })
    } finally {
      setIsSavingDocMeta(null)
    }
  }

  const startRename = (doc: CaseDocumentItem) => {
    setEditingFileNameId(doc.id)
    setFileNameDrafts((prev) => ({ ...prev, [doc.id]: fileNameOverrides[doc.id] || doc.file_name }))
  }

  const cancelRename = (documentId: string) => {
    setEditingFileNameId(null)
    setFileNameDrafts((prev) => {
      const next = { ...prev }
      delete next[documentId]
      return next
    })
  }

  const renameDocument = async (documentId: string) => {
    const fileName = (fileNameDrafts[documentId] || "").trim()
    if (!fileName || fileName.length > 120) {
      toast({
        title: "Invalid file name",
        description: "Please enter a file name between 1 and 120 characters.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSavingDocMeta(documentId)
      const response = await fetch("/api/documents/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, fileName }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "Could not rename document.")
      }

      setFileNameOverrides((prev) => ({ ...prev, [documentId]: payload.fileName || fileName }))
      setEditingFileNameId(null)
      toast({ title: "File name updated" })
      await onUploaded()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not rename document."
      toast({ title: "Rename failed", description: message, variant: "destructive" })
    } finally {
      setIsSavingDocMeta(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Documents ({documents.length})</CardTitle>
        {canUpload && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleUpload}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Document
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!docMetaAvailable && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Document notes/comments need database script 052 before they can be used.
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const uploaderName = profileName(doc.uploader)
              const uploaderRole = doc.uploader?.user_type === "lawyer" ? "Lawyer" : "Client"
              const isOwnUpload = doc.uploaded_by === currentUserId
              const analysisId = doc.document_analysis?.[0]?.id
              const displayFileName = fileNameOverrides[doc.id] || doc.file_name
              const canRename = isOwnUpload && canUpload

              return (
                <div key={doc.id} className="space-y-4 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        {editingFileNameId === doc.id ? (
                          <form
                            className="flex min-w-0 items-center gap-1"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void renameDocument(doc.id)
                            }}
                          >
                            <Input
                              value={fileNameDrafts[doc.id] || ""}
                              onChange={(event) => setFileNameDrafts((prev) => ({ ...prev, [doc.id]: event.target.value }))}
                              className="h-8 max-w-[320px] text-sm"
                              autoFocus
                              disabled={isSavingDocMeta === doc.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isSavingDocMeta === doc.id}
                              aria-label="Save file name"
                            >
                              {isSavingDocMeta === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => cancelRename(doc.id)}
                              disabled={isSavingDocMeta === doc.id}
                              aria-label="Cancel file name edit"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </form>
                        ) : (
                          <div className="flex min-w-0 items-center gap-1">
                            <p className="truncate text-sm font-medium">{displayFileName}</p>
                            {canRename && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground"
                                onClick={() => startRename(doc)}
                                aria-label="Edit file name"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Uploaded by {isOwnUpload ? "You" : `${uploaderName} (${uploaderRole})`} &bull; {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {doc.file_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        </Button>
                      )}
                      {analysisId && onFetchAnalysis && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onFetchAnalysis(analysisId)}
                          disabled={isAnalysisLoading}
                        >
                          {isAnalysisLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Brain className="mr-1 h-3 w-3" />AI Analysis</>}
                        </Button>
                      )}
                    </div>
                  </div>

                  {docMetaAvailable && isOwnUpload && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Private note on your uploaded document</p>
                      <Textarea
                        value={noteDrafts[doc.id] ?? notes[doc.id] ?? ""}
                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [doc.id]: event.target.value }))}
                        placeholder="Add a short note for yourself..."
                        className="min-h-[70px]"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveNote(doc.id)}
                        disabled={isSavingDocMeta === doc.id}
                      >
                        {isSavingDocMeta === doc.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                        Save Note
                      </Button>
                    </div>
                  )}

                  {docMetaAvailable && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        Comments
                      </p>
                      {(comments[doc.id] || []).length > 0 ? (
                        <div className="space-y-2">
                          {(comments[doc.id] || []).map((item) => {
                            const commenterName = profileName(item.commenter, "Participant")
                            const commenterRole = item.commenter?.user_type === "lawyer" ? "Lawyer" : "Client"
                            return (
                              <div key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
                                <p className="text-xs font-medium">
                                  {item.user_id === currentUserId ? "You" : `${commenterName} (${commenterRole})`}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">{item.comment}</p>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No comments yet.</p>
                      )}
                      {!isOwnUpload && (
                        <>
                          <Textarea
                            value={commentDrafts[doc.id] || ""}
                            onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [doc.id]: event.target.value }))}
                            placeholder="Comment on this document..."
                            className="min-h-[70px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addComment(doc.id)}
                            disabled={isSavingDocMeta === doc.id || !(commentDrafts[doc.id] || "").trim()}
                          >
                            {isSavingDocMeta === doc.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                            Add Comment
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
