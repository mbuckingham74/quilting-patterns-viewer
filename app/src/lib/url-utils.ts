/**
 * Validates and sanitizes a return URL to prevent open redirect attacks.
 *
 * Only allows internal paths that:
 * - Start with a single "/" (not "//")
 * - Don't contain protocol schemes like "javascript:", "http:", "https:"
 * - Are within allowed admin paths
 *
 * @param returnUrl - The return URL to validate (may be string, string[], or undefined)
 * @param fallback - The fallback URL if validation fails
 * @returns A safe internal path or the fallback
 */
export function getSafeReturnUrl(
  returnUrl: string | string[] | undefined,
  fallback: string
): string {
  // Normalize array to single string (take first value)
  const url = Array.isArray(returnUrl) ? returnUrl[0] : returnUrl

  if (!url || typeof url !== 'string') {
    return fallback
  }

  // Trim whitespace
  const trimmed = url.trim()

  // Must start with "/" but not "//" (protocol-relative URL)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback
  }

  // Block any protocol schemes (case-insensitive)
  const lowerUrl = trimmed.toLowerCase()
  if (
    lowerUrl.includes('javascript:') ||
    lowerUrl.includes('http:') ||
    lowerUrl.includes('https:') ||
    lowerUrl.includes('data:') ||
    lowerUrl.includes('vbscript:')
  ) {
    return fallback
  }

  // Only allow specific admin paths for now
  // This can be expanded as needed
  const allowedPrefixes = [
    '/admin/triage',
    '/admin/keywords',
    '/admin/recent-imports',
    '/admin/duplicates',
    '/patterns/',
    '/browse',
  ]

  const isAllowed = allowedPrefixes.some(prefix => trimmed.startsWith(prefix))
  if (!isAllowed) {
    return fallback
  }

  return trimmed
}
