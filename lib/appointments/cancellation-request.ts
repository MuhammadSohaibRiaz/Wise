export type CancellationRequester = "client" | "lawyer"

export function resolveCancellationRequester(
  actorId: string,
  clientId: string,
  lawyerId: string,
): CancellationRequester {
  return actorId === clientId ? "client" : "lawyer"
}

export function cancellationRequesterLabel(
  requestedBy: CancellationRequester | null | undefined,
): string {
  if (requestedBy === "client") return "Client"
  if (requestedBy === "lawyer") return "Lawyer"
  return "Unknown party"
}

/** Banner on client/lawyer appointment cards while status is cancellation_requested. */
export function cancellationRequestBannerText(
  requestedBy: CancellationRequester | null | undefined,
  viewer: CancellationRequester,
): string {
  if (!requestedBy) {
    return "Cancellation requested — under admin review. Please wait for admin to resolve this."
  }
  if (requestedBy === viewer) {
    return "You submitted a cancellation request. Waiting for WiseCase admin review."
  }
  return requestedBy === "client"
    ? "The client submitted a cancellation request. Waiting for WiseCase admin review."
    : "The lawyer submitted a cancellation request. Waiting for WiseCase admin review."
}

/** Short line under the status badge. */
export function cancellationRequestStatusHint(
  requestedBy: CancellationRequester | null | undefined,
  viewer: CancellationRequester,
): string {
  if (!requestedBy) return "Under admin review"
  if (requestedBy === viewer) return "Your request — under admin review"
  return `Requested by ${cancellationRequesterLabel(requestedBy).toLowerCase()}`
}
