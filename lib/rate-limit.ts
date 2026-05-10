type Bucket = {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

export function applySimpleRateLimit(input: {
  namespace: string
  key: string
  limit: number
  windowMs: number
}) {
  const now = Date.now()
  const bucketKey = `${input.namespace}:${input.key}`
  const existing = store.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    store.set(bucketKey, { count: 1, resetAt: now + input.windowMs })
    return { ok: true as const, remaining: input.limit - 1, retryAfterSec: 0 }
  }

  if (existing.count >= input.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return { ok: false as const, remaining: 0, retryAfterSec }
  }

  existing.count += 1
  store.set(bucketKey, existing)
  return { ok: true as const, remaining: input.limit - existing.count, retryAfterSec: 0 }
}
