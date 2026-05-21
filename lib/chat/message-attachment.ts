export const ATTACHMENT_MARKER = "__WC_ATTACHMENT_V1__:"

export type MessageAttachmentMeta = {
  bucket: string
  path: string
  name: string
  caption?: string
}

export function encodeAttachment(meta: MessageAttachmentMeta): string {
  return `${ATTACHMENT_MARKER}${JSON.stringify(meta)}`
}

export function parseMessageAttachment(
  content: string,
): { kind: "text"; text: string } | { kind: "attachment"; meta: MessageAttachmentMeta; legacyUrl?: string } {
  if (content.startsWith(ATTACHMENT_MARKER)) {
    try {
      const meta = JSON.parse(content.slice(ATTACHMENT_MARKER.length)) as MessageAttachmentMeta
      if (meta.bucket && meta.path && meta.name) {
        return { kind: "attachment", meta }
      }
    } catch {
      /* fall through */
    }
  }

  const legacy = content.match(/^📎\s+(.+?)\r?\n(\S+)/s)
  if (legacy) {
    const name = legacy[1].trim()
    const legacyUrl = legacy[2].trim()
    const path = storagePathFromSupabaseUrl(legacyUrl)
    if (path) {
      const bucket = bucketFromSupabaseUrl(legacyUrl) ?? "avatars"
      return { kind: "attachment", meta: { bucket, path, name }, legacyUrl }
    }
    return { kind: "attachment", meta: { bucket: "avatars", path: "", name }, legacyUrl }
  }

  return { kind: "text", text: content }
}

export function storagePathFromSupabaseUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    const publicPrefix = "/storage/v1/object/public/"
    const idx = url.pathname.indexOf(publicPrefix)
    if (idx < 0) return null
    const rest = url.pathname.slice(idx + publicPrefix.length)
    const slash = rest.indexOf("/")
    if (slash < 0) return null
    return decodeURIComponent(rest.slice(slash + 1))
  } catch {
    return null
  }
}

export function bucketFromSupabaseUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    const publicPrefix = "/storage/v1/object/public/"
    const idx = url.pathname.indexOf(publicPrefix)
    if (idx < 0) return null
    const rest = url.pathname.slice(idx + publicPrefix.length)
    const slash = rest.indexOf("/")
    if (slash < 0) return null
    return rest.slice(0, slash)
  } catch {
    return null
  }
}

export function attachmentDownloadHref(
  caseId: string,
  meta: MessageAttachmentMeta,
  legacyUrl?: string,
): string {
  const params = new URLSearchParams({ caseId })
  if (meta.path) {
    params.set("bucket", meta.bucket)
    params.set("path", meta.path)
  } else if (legacyUrl) {
    params.set("url", legacyUrl)
  }
  return `/api/messages/attachment?${params.toString()}`
}
