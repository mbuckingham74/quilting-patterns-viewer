import { describe, it, expect } from 'vitest'
import { sanitizeFilenameForHeader, encodeRFC5987 } from './filename'

describe('sanitizeFilenameForHeader', () => {
  describe('CRLF injection (response splitting)', () => {
    it('removes carriage return characters', () => {
      const result = sanitizeFilenameForHeader('file\rname.txt')
      expect(result.asciiFilename).toBe('filename.txt')
      expect(result.contentDisposition).not.toContain('\r')
    })

    it('removes newline characters', () => {
      const result = sanitizeFilenameForHeader('file\nname.txt')
      expect(result.asciiFilename).toBe('filename.txt')
      expect(result.contentDisposition).not.toContain('\n')
    })

    it('removes CRLF sequences', () => {
      const result = sanitizeFilenameForHeader('file\r\nname.txt')
      expect(result.asciiFilename).toBe('filename.txt')
      expect(result.contentDisposition).not.toContain('\r')
      expect(result.contentDisposition).not.toContain('\n')
    })

    it('handles multiple CRLF sequences', () => {
      const result = sanitizeFilenameForHeader('a\r\nb\r\nc.txt')
      expect(result.asciiFilename).toBe('abc.txt')
    })
  })

  describe('backslash escaping', () => {
    it('escapes single backslash', () => {
      const result = sanitizeFilenameForHeader('file\\name.txt')
      expect(result.asciiFilename).toBe('file\\\\name.txt')
    })

    it('escapes multiple backslashes', () => {
      const result = sanitizeFilenameForHeader('a\\b\\c.txt')
      expect(result.asciiFilename).toBe('a\\\\b\\\\c.txt')
    })

    it('escapes backslash before quote correctly', () => {
      // This is the key security case: \" in input should become \\\" not \"
      // Input: file\"name.txt  (backslash followed by quote)
      // Should become: file\\\"name.txt (escaped backslash, escaped quote)
      const result = sanitizeFilenameForHeader('file\\"name.txt')
      expect(result.asciiFilename).toBe('file\\\\\\"name.txt')
    })

    it('handles odd number of backslashes before quote', () => {
      // Input: file\\\"name (3 backslashes + quote)
      // Each \ becomes \\, then " becomes \"
      const result = sanitizeFilenameForHeader('file\\\\\\"name.txt')
      expect(result.asciiFilename).toBe('file\\\\\\\\\\\\\\"name.txt')
    })
  })

  describe('quote escaping', () => {
    it('escapes double quotes', () => {
      const result = sanitizeFilenameForHeader('file"name.txt')
      expect(result.asciiFilename).toBe('file\\"name.txt')
    })

    it('escapes multiple quotes', () => {
      const result = sanitizeFilenameForHeader('a"b"c.txt')
      expect(result.asciiFilename).toBe('a\\"b\\"c.txt')
    })

    it('handles quotes at start and end', () => {
      const result = sanitizeFilenameForHeader('"filename"')
      expect(result.asciiFilename).toBe('\\"filename\\"')
    })
  })

  describe('non-ASCII handling', () => {
    it('replaces non-ASCII with underscore in ASCII filename', () => {
      const result = sanitizeFilenameForHeader('файл.txt')
      expect(result.asciiFilename).toBe('____.txt')
    })

    it('preserves non-ASCII in filename* parameter', () => {
      const result = sanitizeFilenameForHeader('файл.txt')
      expect(result.contentDisposition).toContain('filename*=UTF-8\'\'')
      expect(result.contentDisposition).toContain(encodeURIComponent('файл.txt'))
    })

    it('includes both ASCII and UTF-8 filename for non-ASCII', () => {
      const result = sanitizeFilenameForHeader('日本語.txt')
      expect(result.contentDisposition).toMatch(/filename="[^"]+"; filename\*=UTF-8''/)
    })

    it('does not add filename* for ASCII-only filenames', () => {
      const result = sanitizeFilenameForHeader('simple.txt')
      expect(result.contentDisposition).toBe('attachment; filename="simple.txt"')
      expect(result.contentDisposition).not.toContain('filename*')
    })

    it('handles mixed ASCII and non-ASCII', () => {
      const result = sanitizeFilenameForHeader('file_日本語.txt')
      expect(result.asciiFilename).toBe('file____.txt')
      expect(result.contentDisposition).toContain('filename*=UTF-8\'\'')
    })
  })

  describe('combined attack vectors', () => {
    it('handles CRLF + quote injection attempt', () => {
      // Attempt to inject: Content-Disposition: attachment; filename="a"\r\nX-Injected: header
      const result = sanitizeFilenameForHeader('a"\r\nX-Injected: header')
      expect(result.asciiFilename).not.toContain('\r')
      expect(result.asciiFilename).not.toContain('\n')
      expect(result.asciiFilename).toBe('a\\"X-Injected: header')
    })

    it('handles backslash + CRLF injection attempt', () => {
      const result = sanitizeFilenameForHeader('file\\\r\nname.txt')
      expect(result.asciiFilename).toBe('file\\\\name.txt')
    })

    it('handles non-ASCII + special characters', () => {
      const result = sanitizeFilenameForHeader('файл"test\\.txt')
      expect(result.asciiFilename).toBe('____\\"test\\\\.txt')
    })
  })

  describe('edge cases', () => {
    it('handles empty filename', () => {
      const result = sanitizeFilenameForHeader('')
      expect(result.asciiFilename).toBe('')
      expect(result.contentDisposition).toBe('attachment; filename=""')
    })

    it('handles filename with only special characters', () => {
      const result = sanitizeFilenameForHeader('"\\\r\n')
      // Input: " \ CR LF -> Output: \" \\ (CRLF removed)
      expect(result.asciiFilename).toBe('\\"\\\\')
    })

    it('handles very long filename', () => {
      const longName = 'a'.repeat(1000) + '.txt'
      const result = sanitizeFilenameForHeader(longName)
      expect(result.asciiFilename).toBe(longName)
    })

    it('handles spaces correctly (they are printable ASCII)', () => {
      const result = sanitizeFilenameForHeader('file name with spaces.txt')
      expect(result.asciiFilename).toBe('file name with spaces.txt')
    })
  })

  describe('RFC 5987 special characters', () => {
    it('encodes apostrophe in filename* parameter', () => {
      // Real example from database: "ally's flamingo e2e.qli"
      const result = sanitizeFilenameForHeader("ally's flamingo é2é.qli")
      expect(result.contentDisposition).toContain('%27') // encoded apostrophe
      expect(result.contentDisposition).not.toMatch(/filename\*=UTF-8''[^%]*'/) // no raw apostrophe after UTF-8''
    })

    it('encodes parentheses in filename* parameter', () => {
      const result = sanitizeFilenameForHeader('test (copy) 日本語.txt')
      expect(result.contentDisposition).toContain('%28') // encoded (
      expect(result.contentDisposition).toContain('%29') // encoded )
    })

    it('encodes asterisk in filename* parameter', () => {
      const result = sanitizeFilenameForHeader('pattern*.日本語.qli')
      expect(result.contentDisposition).toContain('%2A') // encoded *
    })

    it('handles real-world filename with apostrophe and non-ASCII', () => {
      // Simulating a real pattern like "anne's garden" with some non-ASCII
      const result = sanitizeFilenameForHeader("anne's gärdén.qli")
      expect(result.asciiFilename).toBe("anne's g_rd_n.qli") // apostrophe preserved in ASCII (it's printable)
      expect(result.contentDisposition).toContain('%27') // apostrophe encoded in filename*
    })
  })
})

describe('encodeRFC5987', () => {
  it('encodes apostrophe', () => {
    expect(encodeRFC5987("O'Brien")).toBe('O%27Brien')
  })

  it('encodes parentheses', () => {
    expect(encodeRFC5987('test (1)')).toBe('test%20%281%29')
  })

  it('encodes asterisk', () => {
    expect(encodeRFC5987('file*.txt')).toBe('file%2A.txt')
  })

  it('encodes all RFC 5987 special chars together', () => {
    const result = encodeRFC5987("O'Brien (test)*.txt")
    expect(result).toBe('O%27Brien%20%28test%29%2A.txt')
    expect(result).not.toContain("'")
    expect(result).not.toContain('(')
    expect(result).not.toContain(')')
    expect(result).not.toContain('*')
  })

  it('preserves already-encoded characters', () => {
    // encodeURIComponent handles most chars, we just add '()*
    expect(encodeRFC5987('hello world')).toBe('hello%20world')
  })
})
