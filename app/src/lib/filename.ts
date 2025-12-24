/**
 * RFC 5987 compliant percent-encoding for ext-value.
 * encodeURIComponent leaves '()* unencoded, which violates RFC 5987.
 * This function additionally encodes those characters.
 */
function encodeRFC5987(str: string): string {
  return encodeURIComponent(str)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/**
 * Sanitizes a filename for use in Content-Disposition headers.
 * Prevents header injection, response splitting, and encoding issues.
 *
 * @param rawFilename - The original filename from the database
 * @returns Object with asciiFilename (safe fallback) and contentDisposition header value
 */
export function sanitizeFilenameForHeader(rawFilename: string): {
  asciiFilename: string
  contentDisposition: string
} {
  // Remove CRLF first (response splitting prevention)
  const safeName = rawFilename.replace(/[\r\n]/g, '')

  // ASCII-safe version: escape backslashes then quotes, replace non-ASCII
  const asciiFilename = safeName
    .replace(/\\/g, '\\\\')      // Escape backslashes FIRST
    .replace(/"/g, '\\"')        // Then escape quotes
    .replace(/[^\x20-\x7E]/g, '_') // Replace non-ASCII with underscore

  // Check if filename has non-ASCII characters for RFC 5987 filename* parameter
  const hasNonAscii = /[^\x00-\x7F]/.test(rawFilename)

  // Build Content-Disposition header
  // Use filename* (RFC 5987) for UTF-8 encoding if original has non-ASCII
  const contentDisposition = hasNonAscii
    ? `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeRFC5987(safeName)}`
    : `attachment; filename="${asciiFilename}"`

  return { asciiFilename, contentDisposition }
}

// Export for testing
export { encodeRFC5987 }
