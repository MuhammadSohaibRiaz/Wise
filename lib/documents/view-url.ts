export function documentViewUrl(documentId: string) {
  return `/api/documents/view/${encodeURIComponent(documentId)}`
}
