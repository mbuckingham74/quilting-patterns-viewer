/**
 * Safe fetch utilities for server-side requests
 * Provides SSRF protection by allowlisting hosts and limiting response sizes
 */

// Allowlist of hosts that can serve thumbnails
const ALLOWED_THUMBNAIL_HOSTS = [
  'base.tachyonfuture.com', // Supabase storage
]

// Maximum image size (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/**
 * Safely fetch a thumbnail from an allowlisted host
 * @param url - The thumbnail URL to fetch
 * @param timeoutMs - Request timeout in milliseconds (default 30s)
 * @returns Buffer containing the image data
 * @throws Error if host not allowed, timeout, or image too large
 */
export async function fetchThumbnailSafe(
  url: string,
  timeoutMs = 30000
): Promise<Buffer> {
  // Parse and validate the URL
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid thumbnail URL: ${url}`)
  }

  // Check host against allowlist
  if (!ALLOWED_THUMBNAIL_HOSTS.includes(parsed.host)) {
    throw new Error(`Disallowed thumbnail host: ${parsed.host}`)
  }

  // Only allow HTTPS in production
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('HTTPS required for thumbnail URLs in production')
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Failed to download thumbnail: HTTP ${response.status}`)
  }

  // Check Content-Length header if present
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (!Number.isNaN(size) && size > MAX_IMAGE_SIZE) {
      throw new Error(`Thumbnail too large: ${size} bytes (max ${MAX_IMAGE_SIZE})`)
    }
  }

  // Read and validate actual size
  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    throw new Error(`Thumbnail too large: ${arrayBuffer.byteLength} bytes (max ${MAX_IMAGE_SIZE})`)
  }

  return Buffer.from(arrayBuffer)
}

/**
 * Safely fetch a thumbnail and return as base64
 * @param url - The thumbnail URL to fetch
 * @returns Base64 string or null if fetch fails
 */
export async function fetchThumbnailAsBase64(
  url: string | null
): Promise<string | null> {
  if (!url) return null

  try {
    const buffer = await fetchThumbnailSafe(url)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Error fetching thumbnail:', error)
    return null
  }
}
