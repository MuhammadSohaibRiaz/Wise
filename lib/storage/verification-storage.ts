/** App proxy URL for admin to view a lawyer's license (private verifications bucket). */
export function adminLicenseViewUrl(lawyerId: string) {
  return `/api/admin/lawyers/${encodeURIComponent(lawyerId)}/license`
}

/** Extract object path inside the verifications bucket from a stored URL or path. */
export function storagePathFromVerificationUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    const markers = [
      "/storage/v1/object/public/verifications/",
      "/storage/v1/object/sign/verifications/",
      "/storage/v1/object/authenticated/verifications/",
    ]
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker)
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length))
      }
    }
    return null
  } catch {
    const trimmed = fileUrl.trim()
    if (trimmed.startsWith("licenses/")) return trimmed
    if (trimmed.startsWith("verifications/")) return trimmed.slice("verifications/".length)
    return trimmed || null
  }
}

export function guessContentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "pdf":
      return "application/pdf"
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    default:
      return "application/octet-stream"
  }
}

export function fileNameFromStoragePath(path: string): string {
  const base = path.split("/").pop() || "license"
  return base.replace(/[^\w.-]/g, "_").slice(0, 120) || "license"
}
