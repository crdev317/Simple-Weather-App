import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The candidate-list and current-conditions render paths must never inject raw
// HTML: React's default text escaping is the XSS control at the external-API →
// DOM trust boundary, and a single `dangerouslySetInnerHTML` (or equivalent)
// silently bypasses it. This guard fails closed if one is ever introduced,
// independent of whether a behavioural payload happens to exercise it.
const RENDER_PATH_SOURCES = ['./CandidateList.tsx', './CurrentConditionsReadout.tsx']

describe('render paths forbid raw-HTML injection (XSS guard)', () => {
  it.each(RENDER_PATH_SOURCES)(
    'does not use dangerouslySetInnerHTML in %s',
    (relativePath) => {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
      expect(source).not.toContain('dangerouslySetInnerHTML')
    },
  )
})
