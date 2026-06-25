export interface ProductXpImage {
  ThumbnailUrl?: string
  Url?: string
}

export interface ProductXp {
  Images?: ProductXpImage[]
  RAI?: Record<string, unknown>
}

export function parseProductXp(xp: unknown): ProductXp {
  if (!xp) return {}
  if (typeof xp === 'string') {
    try {
      const parsed = JSON.parse(xp) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as ProductXp)
        : {}
    } catch {
      return {}
    }
  }

  return typeof xp === 'object' && !Array.isArray(xp) ? (xp as ProductXp) : {}
}
