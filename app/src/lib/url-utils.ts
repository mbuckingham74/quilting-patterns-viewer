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

  // Split into path and query parts for separate validation
  const [pathPart, queryPart] = trimmed.split('?')

  // Block protocol schemes in the PATH portion only (not query params)
  // Using regex to match scheme pattern: letter followed by letters/digits/+/./- then colon
  // This avoids false positives like /patterns?ref=http://example.com
  const schemePattern = /^[a-z][a-z0-9+.-]*:/i
  const lowerPath = pathPart.toLowerCase()
  if (
    schemePattern.test(lowerPath) ||
    lowerPath.includes('javascript:') ||
    lowerPath.includes('data:') ||
    lowerPath.includes('vbscript:')
  ) {
    return fallback
  }

  // Block path traversal attempts in the path portion
  // Check for ".." both raw and URL-encoded (%2e%2e)
  if (pathPart.includes('..') || pathPart.toLowerCase().includes('%2e%2e')) {
    return fallback
  }

  // Only allow specific internal paths
  const allowedPrefixes = [
    // Admin pages
    '/admin/triage',
    '/admin/keywords',
    '/admin/recent-imports',
    '/admin/duplicates',
    '/admin/analytics',
    '/admin/exceptions',
    '/admin/videos',
    '/admin/approved-users',
    '/admin/users',
    '/admin/upload',
    '/admin/batches',
    '/admin/activity',
    '/admin/help',
    '/admin/patterns',
    // User pages
    '/patterns/',
    '/browse',
    '/account',
  ]

  const isAllowed = allowedPrefixes.some(prefix => trimmed.startsWith(prefix))
  if (!isAllowed) {
    return fallback
  }

  // Reconstruct URL (preserves original query params if present)
  return queryPart ? `${pathPart}?${queryPart}` : pathPart
}
