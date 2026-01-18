import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[]
  action: () => void
  description: string
}

/**
 * Hook to handle keyboard shortcuts
 * @param shortcuts Array of keyboard shortcuts to register
 * @param enabled Whether shortcuts are active (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if focused in input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        // Check if key matches first
        const keyMatches =
          e.key.toLowerCase() === shortcut.key.toLowerCase() ||
          // Handle special cases - match the actual key produced
          (shortcut.key === ' ' && e.key === ' ') ||
          (shortcut.key === '?' && e.key === '?')

        if (!keyMatches) continue

        // Check if modifiers match
        const requiredModifiers = shortcut.modifiers || []

        // Special case: '?' requires Shift on most keyboards, so we allow it
        const isShiftedSymbol = shortcut.key === '?' || shortcut.key === '!'

        let modifiersMatch: boolean
        if (requiredModifiers.length === 0) {
          // No modifiers required - but allow Shift for shifted symbols like ?
          modifiersMatch =
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey &&
            (isShiftedSymbol || !e.shiftKey)
        } else {
          // Specific modifiers required
          modifiersMatch =
            requiredModifiers.every((mod) => {
              switch (mod) {
                case 'ctrl':
                  return e.ctrlKey
                case 'shift':
                  return e.shiftKey
                case 'alt':
                  return e.altKey
                case 'meta':
                  return e.metaKey
              }
            }) &&
            // Ensure no extra modifiers are pressed (except Shift for shifted symbols)
            (requiredModifiers.includes('ctrl') || !e.ctrlKey) &&
            (requiredModifiers.includes('shift') || isShiftedSymbol || !e.shiftKey) &&
            (requiredModifiers.includes('alt') || !e.altKey) &&
            (requiredModifiers.includes('meta') || !e.metaKey)
        }

        if (modifiersMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.modifiers?.includes('ctrl')) {
    parts.push('Ctrl')
  }
  if (shortcut.modifiers?.includes('alt')) {
    parts.push('Alt')
  }
  if (shortcut.modifiers?.includes('shift')) {
    parts.push('Shift')
  }
  if (shortcut.modifiers?.includes('meta')) {
    parts.push('⌘')
  }

  // Format the key nicely
  let keyDisplay = shortcut.key.toUpperCase()
  if (shortcut.key === ' ') {
    keyDisplay = 'Space'
  } else if (shortcut.key === '?') {
    keyDisplay = '?'
  }

  parts.push(keyDisplay)

  return parts.join(' + ')
}
